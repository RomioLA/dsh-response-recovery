import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerHooks } from 'node:module'
import { selectRecovery, turnEvents } from '../src/recovery.mjs'
import { assembleAssistantStream } from '@deepseek-ai/dsh-llm/assistant-stream'
import { createAssistantMessage } from '@deepseek-ai/dsh-llm'

const core = resolve('_upstream/deepseek-harness/packages/core/session/src/index.ts')
const meter = resolve('_upstream/deepseek-harness/packages/llm/token-meter/src/turn-usage.ts')
const available = existsSync(core) && existsSync(meter)
const { Session, SessionId, RESPONSE_RECOVERY_CONTRACT_VERSION } = available
  ? await import(pathToFileURL(core).href)
  : {}

/** Real compact-assembler input, with only synthetic test text and token usage. */
const usage = { inputTokens: 10, outputTokens: 5, totalTokens: 15 }
function stream(text, extra = []) {
  return [{ type: 'text-chunks', index: 0, time0: 0, dt: [0], texts: [text] },
    { type: 'chunk', time: 0, chunk: { type: 'usage', usage } }, ...extra]
}
const reason = { kind: 'error', error: { code: 'PI_AI_ERROR', message: 'synthetic failure' } }
let serial = 0

function fixture(lengths, terminal = reason) {
  const session = Session.create(SessionId('recovery-' + (++serial)))
  session.append('turn/start', { turn: 1 })
  session.append('step/start', { turn: 1, step: 1 })
  const attempts = lengths.map(n => session.append('assistant/attempt', {
    turn: 1, step: 1, stream: stream('X'.repeat(n)),
  }))
  session.append('step/end', { turn: 1, step: 1 })
  session.append('turn/end', { turn: 1, reason: terminal })
  return { session, attempts }
}
function appendRecovered(session, selected, override = {}) {
  return session.append('assistant/message', {
    turn: 1, step: selected.step,
    message: createAssistantMessage({
      content: selected.content, source: { provider: 'fixture', model: 'neutral' },
    }),
    stream: [],
    recovery: { sourceAttemptSeq: selected.sourceAttemptSeq, reason: 'upstream-failure' },
    ...override,
  }, { surfaceOp: 'append' })
}
test('source checkout and Recovery capability are available', { skip: !available }, () => {
  assert.equal(RESPONSE_RECOVERY_CONTRACT_VERSION, 1)
})
test('Turn 29 selects second attempt (42 -> 566), not concatenation', { skip: !available }, () => {
  const { session, attempts } = fixture([42, 566])
  const selected = selectRecovery(turnEvents(session, 1), 1, assembleAssistantStream)
  assert.equal(selected.sourceAttemptSeq, attempts[1].seq)
  assert.equal(selected.content[0].text.length, 566)
  appendRecovered(session, selected)
  assert.equal(session.deriveMessages()[0].content[0].text.length, 566)
})
test('Turn 30 selects first attempt (1206 -> 42)', { skip: !available }, () => {
  const { session, attempts } = fixture([1206, 42])
  const selected = selectRecovery(turnEvents(session, 1), 1, assembleAssistantStream)
  assert.equal(selected.sourceAttemptSeq, attempts[0].seq)
  appendRecovered(session, selected)
  const reloaded = Session.create(SessionId('after-reload'), session.snapshotEvents())
  const recovery = reloaded.snapshotEvents().find(x => x.type === 'assistant/message')
  assert.equal(recovery.data.recovery.sourceAttemptSeq, attempts[0].seq)
  assert.equal(reloaded.deriveMessages()[0].content[0].text.length, 1206)
  assert.equal(selectRecovery(turnEvents(reloaded, 1), 1, assembleAssistantStream), null)
})
test('duplicate appended recovery is rejected atomically', { skip: !available }, () => {
  const { session } = fixture([120])
  const selected = selectRecovery(turnEvents(session, 1), 1, assembleAssistantStream)
  appendRecovered(session, selected)
  const previous = session.seq
  assert.throws(() => appendRecovered(session, selected), /duplicate/)
  assert.equal(session.seq, previous)
})
test('forged source sequence and forged text are rejected', { skip: !available }, () => {
  const { session } = fixture([110])
  const selected = selectRecovery(turnEvents(session, 1), 1, assembleAssistantStream)
  assert.throws(() => appendRecovered(session, selected, {
    recovery: { sourceAttemptSeq: 0, reason: 'upstream-failure' },
  }), /source/)
  assert.throws(() => appendRecovered(session, selected, {
    message: createAssistantMessage({
      content: [{ type: 'text', text: 'changed' }],
      source: { provider: 'fixture', model: 'neutral' },
    }),
  }), /match/)
  assert.equal(session.deriveMessages().length, 0)
})
test('successful retry, cancellation, and empty text are not recovered', { skip: !available }, () => {
  const success = fixture([180], { kind: 'completed' }).session
  assert.equal(selectRecovery(turnEvents(success, 1), 1, assembleAssistantStream), null)
  const aborted = fixture([90], { kind: 'aborted', reason: { kind: 'user' } }).session
  assert.equal(selectRecovery(turnEvents(aborted, 1), 1, assembleAssistantStream), null)
  const empty = fixture([0]).session
  assert.equal(selectRecovery(turnEvents(empty, 1), 1, assembleAssistantStream), null)
})
test('reasoning-only failed attempt never produces visible text', { skip: !available }, () => {
  const s=Session.create(SessionId('reasoning-only'))
  s.append('turn/start',{turn:1})
  s.append('step/start',{turn:1,step:1})
  s.append('assistant/attempt',{turn:1,step:1,stream:[
    {type:'reasoning-chunks',index:0,time0:0,dt:[0],texts:['not visible']},
  ]})
  s.append('step/end',{turn:1,step:1})
  s.append('turn/end',{turn:1,reason})
  assert.equal(selectRecovery(turnEvents(s,1),1,assembleAssistantStream),null)
})
test('core Token Meter ignores Recovery, preserving original usage and invalid silent retries', { skip: !available }, async () => {
  const { deriveTurnTokenUsage: fold } = await import(pathToFileURL(meter).href)
  const { session } = fixture([100])
  const base=session.snapshotEvents()
  assert.equal(fold(base)?.totalTokens,15)
  const selected=selectRecovery(turnEvents(session,1),1,assembleAssistantStream)
  appendRecovered(session,selected)
  assert.equal(fold(session.snapshotEvents())?.totalTokens,15)
  const silent=fixture([100,80]).session
  assert.equal(fold(silent.snapshotEvents()),undefined)
  const chosen=selectRecovery(turnEvents(silent,1),1,assembleAssistantStream)
  appendRecovered(silent,chosen)
  assert.equal(fold(silent.snapshotEvents()),undefined)
})
test('plugin install hook can recover once and stay idempotent after reload', { skip: !available }, async () => {
  registerHooks({
    resolve(specifier,context,next) {
      if(specifier==='@deepseek-ai/dsh-session')
        return {url:pathToFileURL(core).href,shortCircuit:true}
      return next(specifier,context)
    }
  })
  const plugin=await import('../src/index.js')
  const handlers=[]
  const ctx={on(name,handler){handlers.push({name,handler})}}
  plugin.apply(ctx)
  assert.equal(handlers.length,1)
  assert.equal(handlers[0].name,'agent/failed-turn-settled')
  const { session }=fixture([42,566])
  await handlers[0].handler({agent:{session,options:{provider:'mock',model:'test'}},turn:1})
  assert.equal(session.deriveMessages().length,1)
  await handlers[0].handler({agent:{session,options:{}},turn:1})
  assert.equal(session.deriveMessages().length,1)
  const reloaded=Session.create(SessionId('restart'),session.snapshotEvents())
  await handlers[0].handler({agent:{session:reloaded,options:{}},turn:1})
  assert.equal(reloaded.deriveMessages().length,1)
})

test('Recovery write is rejected before failed turn/end and accepted after it', { skip: !available }, () => {
  const session = Session.create(SessionId('write-timing'))
  session.append('turn/start', { turn: 1 })
  session.append('step/start', { turn: 1, step: 1 })
  const source = session.append('assistant/attempt', { turn: 1, step: 1, stream: stream('terminal text') })
  const candidate = { sourceAttemptSeq: source.seq, step: 1, content: [{ type: 'text', text: 'terminal text' }] }
  const before = session.seq
  assert.throws(() => appendRecovered(session, candidate), /terminal failed turn/)
  assert.equal(session.seq, before)
  session.append('step/end', { turn: 1, step: 1 })
  assert.throws(() => appendRecovered(session, candidate), /terminal failed turn/)
  session.append('turn/end', { turn: 1, reason })
  appendRecovered(session, candidate)
  assert.equal(session.deriveMessages().at(-1).content[0].text, 'terminal text')
})
test('recovery tie-break is deterministic and earlier attempt wins', { skip: !available }, () => {
  const { session, attempts } = fixture([90, 90])
  assert.equal(selectRecovery(turnEvents(session, 1), 1, assembleAssistantStream).sourceAttemptSeq, attempts[0].seq)
})
test('unfinished tool-only attempt does not produce a recoverable assistant message', { skip: !available }, () => {
  const session = Session.create(SessionId('unfinished-tool'))
  session.append('turn/start', { turn: 1 })
  session.append('step/start', { turn: 1, step: 1 })
  session.append('assistant/attempt', { turn: 1, step: 1, stream: [{
    type: 'tool-call-chunks', index: 0, time0: 0, dt: [0],
    id: 'call-fixture', name: 'fixtureTool', args: ['{"unused":1'],
  }] })
  session.append('step/end', { turn: 1, step: 1 })
  session.append('turn/end', { turn: 1, reason })
  assert.equal(selectRecovery(turnEvents(session, 1), 1, assembleAssistantStream), null)
})
test('restored Session rejects forged Recovery provenance', { skip: !available }, () => {
  const { session } = fixture([123])
  const selected = selectRecovery(turnEvents(session, 1), 1, assembleAssistantStream)
  appendRecovered(session, selected)
  const corrupted = structuredClone(session.snapshotEvents())
  const rec = corrupted.find(e => e.type === 'assistant/message')
  rec.data.recovery.sourceAttemptSeq = 0
  assert.throws(() => Session.create(SessionId('forged-seed'), corrupted), /source/)
  assert.equal(session.deriveMessages().length, 1)
})
