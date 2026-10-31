import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createAssistantMessage } from '@deepseek-ai/dsh-llm'

const source = resolve('_upstream/deepseek-harness/packages/client/ui-chat/src/client/conversation-nodes/assistant.ts')
const tailSource = resolve('_upstream/deepseek-harness/packages/client/ui-chat/src/client/conversation-nodes/turn-tail.ts')
const available = existsSync(source) && existsSync(tailSource)
const assistantDefinition = available
  ? (await import(pathToFileURL(source).href)).assistantDefinition
  : null
const turnTailDefinition = available
  ? (await import(pathToFileURL(tailSource).href)).turnTailDefinition
  : null

function viewOf(recovered) {
  const start = { event: { type: 'step/start', seq: 1, time: 1, data: { turn: 1, step: 1 } } }
  const message = createAssistantMessage({
    content: [{ type: 'text', text: 'recoverable text' }],
    source: { provider: 'mock', model: 'fixture' },
  })
  const event = { type: 'assistant/message', seq: 5, time: 5, surfaceOp: 'append', data: {
    turn: 1, step: 1, message, stream: [],
    ...recovered ? { recovery: { sourceAttemptSeq: 2, reason: 'upstream-failure' } } : {},
  }}
  const match = { event }
  const begin = assistantDefinition.start({}, start)
  const state = assistantDefinition.update({ state: begin }, match)
  return assistantDefinition.buildLocationData({ state, start, matches: [match] }, 'step')
}
test('recovered assistant is a native interrupted message, not a new Chat node kind', { skip: !available }, () => {
  const projected = viewOf(true)
  assert.equal(projected.kind, 'step')
  assert.equal(projected.value.status, 'interrupted')
  assert.equal(projected.value.finalNode.interrupted, true)
  assert.equal(projected.value.blocks[0].text, 'recoverable text')
  const normal = viewOf(false)
  assert.equal(normal.value.status, 'settled')
  assert.notEqual(normal.value.finalNode.interrupted, true)
  assert.equal(assistantDefinition.match({type:'assistant/message',surfaceOp:'append',data:{turn:1,step:1}}).id,'1:1')
})
test('completed Turn Tail keeps recovered failures branch-unavailable', { skip: !available }, () => {
  const assistant=viewOf(true).value
  const start={event:{type:'turn/start',data:{turn:1},seq:0,time:0},location:{
    kind:'turn',turn:{turn:1,status:'closed',steps:[{data:new Map([['assistant-step',assistant]])}]}
  }}
  const end={event:{type:'turn/end',data:{turn:1,reason:{kind:'error'}},seq:4,time:4}}
  const marker={event:{type:'assistant/message',data:{turn:1,step:1,recovery:{sourceAttemptSeq:2,reason:'upstream-failure'}},seq:5,time:5}}
  const state=turnTailDefinition.update({state:turnTailDefinition.start({},start)},end)
  const projected=turnTailDefinition.buildLocationData({state,start,matches:[start,end,marker]},'turn')
  assert.equal(projected.kind,'turn')
  assert.equal(projected.value.branchUnavailable,true)
  assert.equal(projected.value.closing.finalNode.interrupted,true)
})
test('recovered assistant anchor remains before completed Turn Tail', { skip: !available }, () => {
  const message = createAssistantMessage({ content:[{type:'text',text:'recovered fixture'}],
    source:{provider:'mock',model:'fixture'} })
  const startEvent = {type:'step/start',seq:1,time:1,data:{turn:1,step:1}}
  const recoveryEvent = {type:'assistant/message',seq:6,time:6,surfaceOp:'append',
    data:{turn:1,step:1,message,stream:[],recovery:{sourceAttemptSeq:2,reason:'upstream-failure'}}}
  const start={event:startEvent}
  const result={event:recoveryEvent}
  const state=assistantDefinition.update({state:assistantDefinition.start({},start)},result)
  const value=assistantDefinition.buildLocationData({state,start,matches:[result]},'step').value
  const location={kind:'step',
    turn:{turn:1,status:'closed',end:{seq:5,time:5}},
    step:{turn:1,step:1,status:'closed',end:{seq:4,time:4},data:new Map([['assistant-step',value]])}}
  start.location=location
  const node=assistantDefinition.buildViewNode({state,start,matches:[result],
    key:'assistant:1:1',id:'1:1',current:new Map()})
  assert.equal(node?.kind,'assistant-step')
  assert.ok(node.anchorSeq < 5.1, 'recovery must display before Turn Tail')
})
