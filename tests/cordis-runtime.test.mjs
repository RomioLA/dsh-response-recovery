import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import { createAssistantMessage } from '@deepseek-ai/dsh-llm'
const source = pathToFileURL(resolve('_upstream/deepseek-harness/packages/core/session/src/index.ts')).href
registerHooks({resolve(spec,context,next) {
  if (spec === '@deepseek-ai/dsh-session') return {url:source,shortCircuit:true}
  return next(spec,context)
}})
class Agents extends Service { constructor(ctx) { super(ctx,'agents') } }
class Sessions extends Service { constructor(ctx) { super(ctx,'sessions') } }

test('real Cordis activates Recovery plugin, owns and disposes listener without mutating Session', async () => {
  const plugin = await import('../src/index.js')
  const { Session, SessionId } = await import(source)
  const ctx = new Context()
  await ctx.plugin(Agents)
  await ctx.plugin(Sessions)
  const fiber = await ctx.plugin(plugin)
  assert.ok(fiber)
  assert.notEqual(fiber.status,'pending')
  const session = Session.create(SessionId('cordis-integration-synthetic'))
  session.append('turn/start',{turn:1})
  session.append('step/start',{turn:1,step:1})
  session.append('assistant/attempt',{turn:1,step:1,stream:[
    {type:'text-chunks',index:0,time0:1,dt:[0],texts:['test text']}
  ]})
  session.append('step/end',{turn:1,step:1})
  session.append('turn/end',{turn:1,reason:{kind:'error',error:{code:'MOCK',message:'synthetic'}}})
  const agent={session,options:{provider:'mock',model:'mock'}}
  await ctx.serial(agent,'agent/failed-turn-settled',{agent,turn:1})
  assert.equal(session.deriveMessages().filter(m=>m.role==='assistant').length,1)
  await fiber.dispose()
  const before=session.seq
  await ctx.serial(agent,'agent/failed-turn-settled',{agent,turn:1})
  assert.equal(session.seq,before)
  const loaded=Session.create(SessionId('cordis-reloaded'),session.snapshotEvents())
  assert.equal(loaded.deriveMessages().filter(m=>m.role==='assistant').length,1)
  const again = await ctx.plugin(plugin)
  await ctx.serial(agent,'agent/failed-turn-settled',{agent,turn:1})
  assert.equal(session.seq,before, 're-enable must not duplicate durable recovery')
  await again.dispose()
  await ctx.fiber.dispose()
})
