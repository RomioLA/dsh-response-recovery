import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const sources = {
  '@deepseek-ai/dsh-session': pathToFileURL(resolve('_upstream/deepseek-harness/packages/core/session/lib/index.js')).href,
  '@deepseek-ai/dsh-agent-loop': pathToFileURL(resolve('_upstream/deepseek-harness/packages/core/agent-loop/lib/index.js')).href,
}
registerHooks({resolve(spec,ctx,next) {
  return Object.hasOwn(sources,spec) ? {url:sources[spec],shortCircuit:true} : next(spec,ctx)
}})
const [{Context},{default:AgentRegistry},{default:AgentLoop},{default:SessionProjectionRegistry},
  llm,{default:SessionStore,SessionId},{default:SystemPrompt},{default:ToolRuntime},plugin] = await Promise.all([
  import('@deepseek-ai/cordis'), import('@deepseek-ai/dsh-agent'),
  import('@deepseek-ai/dsh-agent-loop'), import('@deepseek-ai/dsh-session-projection'),
  import('@deepseek-ai/dsh-llm'), import('@deepseek-ai/dsh-session'),
  import('@deepseek-ai/dsh-system-prompt'), import('@deepseek-ai/dsh-tools'),
  import('../src/index.js'),
])
let serial=0
const response=(text,failed)=>[
  {type:'block-start',index:0,blockType:'text'},
  {type:'text-delta',index:0,text},
  {type:'block-end',index:0,block:{type:'text',text}},
  {type:'usage',usage:{inputTokens:10,outputTokens:text.length,totalTokens:10+text.length}},
  {type:'finish',reason: failed
    ? {kind:'error',failure:{code:'CONTENT_FILTER',message:'synthetic content filter'}}
    : {kind:'stop'}},
]
class MockAdapter extends llm.LlmAdapter {
  constructor(script){super();this.script=[...script];this.requests=[]}
  async resolveModel(provider,model){return {provider,id:model,name:model}}
  async *stream(options){
    this.requests.push(options)
    const next=this.script.shift()
    if(!next)throw Error('mock script exhausted')
    for(const chunk of next)yield chunk
  }
}
async function setup(script,withPlugin=true){
  const ctx=new Context()
  await ctx.plugin(llm.default)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop,{agents:[]})
  const adapter=new MockAdapter(script)
  ctx.llm.registerAdapter(['mock'],adapter)
  if(withPlugin)await ctx.plugin(plugin)
  const agent=await ctx.agentLoop.create(SessionId('native-loop-test-'+ ++serial),{provider:'mock',model:'mock'})
  return {ctx,agent,adapter}
}
function send(agent,text='go'){
 agent.followup(llm.createUserMessage({content:[{type:'text',text}],source:{kind:'user'}}))
}
test('real patched Agent Loop recovers final error and next request includes text', {timeout:25000},async()=>{
 const {ctx,agent,adapter}=await setup([response('visible recoverable payload',true),response('second reply',false)])
 try {
  send(agent);await agent.whenIdle()
  const events=agent.session.snapshotEvents()
  assert.equal(events.filter(e=>e.type==='assistant/attempt').length,1)
  assert.equal(events.find(e=>e.type==='turn/end').data.reason.kind,'error')
  assert.equal(events.filter(e=>e.type==='assistant/message').length,1)
  send(agent,'continue');await agent.whenIdle()
  assert.equal(adapter.requests.length,2)
  assert.match(JSON.stringify(adapter.requests[1].messages),/visible recoverable payload/)
 }finally{await ctx.fiber.dispose()}
})
test('real Agent Loop success after silent retry ignores failed draft', {timeout:25000},async()=>{
 const {ctx,agent}=await setup([response('bad draft',true),response('good answer',false)])
 try {
  let n=0;ctx.on('agent/request-error',async()=>{if(n++===0)return {kind:'retry'}})
  send(agent);await agent.whenIdle()
  assert.equal(agent.session.snapshotEvents().filter(e=>e.type==='assistant/attempt').length,1)
  assert.equal(agent.session.snapshotEvents().filter(e=>e.type==='assistant/message').length,1)
  assert.doesNotMatch(JSON.stringify(agent.session.deriveMessages()),/bad draft/)
 }finally{await ctx.fiber.dispose()}
})
test('real Agent Loop selects longer failed attempt after silent retry', {timeout:25000},async()=>{
 const {ctx,agent}=await setup([response('short',true),response('much longer recovered message',true)])
 try {
  let n=0;ctx.on('agent/request-error',async()=>{if(n++===0)return {kind:'retry'}})
  send(agent);await agent.whenIdle()
  const events=agent.session.snapshotEvents()
  assert.equal(events.filter(e=>e.type==='assistant/attempt').length,2)
  assert.equal(events.filter(e=>e.type==='assistant/message').length,1)
  assert.match(JSON.stringify(agent.session.deriveMessages()),/much longer recovered message/)
 }finally{await ctx.fiber.dispose()}
})
test('real Agent Loop catches throwing terminal Hook without altering error', {timeout:25000},async()=>{
 const {ctx,agent}=await setup([response('text',true)],false)
 try {
  ctx.on('agent/failed-turn-settled',()=>{throw Error('fixture listener failed')})
  send(agent);await agent.whenIdle()
  assert.equal(agent.session.snapshotEvents().find(e=>e.type==='turn/end').data.reason.kind,'error')
  assert.equal(agent.session.snapshotEvents().filter(e=>e.type==='assistant/message').length,0)
 }finally{await ctx.fiber.dispose()}
})
test('real Agent Loop waits for terminal Hook before assembling next model request', {timeout:25000},async()=>{
 const {ctx,agent,adapter}=await setup([response('held recovery text',true),response('later success',false)])
 let release,entered
 const gate=new Promise(resolve=>{release=resolve})
 const started=new Promise(resolve=>{entered=resolve})
 try {
  ctx.on('agent/failed-turn-settled',async()=>{entered();await gate})
  send(agent)
  await started
  send(agent,'follow-up')
  assert.equal(adapter.requests.length,1)
  release()
  await agent.whenIdle()
  assert.equal(adapter.requests.length,2)
  assert.match(JSON.stringify(adapter.requests[1].messages),/held recovery text/)
 }finally{release?.();await ctx.fiber.dispose()}
})
