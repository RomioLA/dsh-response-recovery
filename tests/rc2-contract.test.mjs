import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'

const modules = process.env.DSH_MODULES ??
  'E:/AI/DeepSeek Harness/resources/app/dsh/node_modules/@deepseek-ai'
const resolveModule = (pkg, file) =>
  pathToFileURL(join(modules, pkg, 'lib', file)).href
const { Session, SessionId, isSurfaceEligibleType } = await import(resolveModule('dsh-session', 'index.js'))
const { createAssistantMessage } = await import(resolveModule('dsh-llm', 'index.js'))

const recoveredMessage = () => createAssistantMessage({
  content: [{ type: 'text', text: 'Neutral recovery fixture' }],
  source: { provider: 'mock', model: 'fixture' },
})

test('0.2.1-rc.2: append after failed turn is accepted by Session and is model-visible', () => {
  const session = Session.create(SessionId('dsh-response-recovery-isolated-fixture'))
  session.append('turn/start', { turn: 1 })
  session.append('step/start', { turn: 1, step: 1 })
  session.append('assistant/attempt', { turn: 1, step: 1, stream: [] })
  session.append('step/end', { turn: 1, step: 1 })
  session.append('turn/end', { turn: 1, reason: { kind: 'error' } })
  session.append('assistant/message', {
    turn: 1, step: 1, message: recoveredMessage(), stream: [],
  }, { surfaceOp: 'append' })
  const derived = session.deriveMessages()
  assert.equal(derived.length, 1)
  assert.equal(derived[0].role, 'assistant')
  assert.equal(derived[0].content[0].text, 'Neutral recovery fixture')
})

test('0.2.1-rc.2: plugin-owned events and assistant/attempt are not Surface append candidates', () => {
  assert.equal(isSurfaceEligibleType('assistant/attempt'), false)
  assert.equal(isSurfaceEligibleType('response-recovery/recovered'), false)
  assert.equal(isSurfaceEligibleType('assistant/message'), true)
})

/**
 * Execute the actual deriveTurnTokenUsage function extracted directly from
 * the installed DSH 0.2.1-rc.2 Web client bundle. Only the normalization
 * helpers are supplied as neutral fixture stubs to isolate lifecycle logic.
 * This test is not a rendered Web UI integration test.
 */
function loadRealWebTurnUsageFold() {
  const path = join(modules, 'dsh-client-ui-chat', 'lib', 'client.js')
  const bundle = readFileSync(path, 'utf8')
  const start = bundle.indexOf('function deriveTurnTokenUsage(events) {')
  assert.ok(start >= 0, 'installed Web implementation not found')
  const end = bundle.indexOf('//#endregion', start)
  assert.ok(end > start, 'installed Web function boundary not found')
  const code = bundle.slice(start, end)
  return vm.runInNewContext(code + '\n deriveTurnTokenUsage', {
    streamUsage: (stream) => stream?.find((item) => item.type === 'usage')?.usage,
    normalizeUsage: (usage) => usage,
    aggregateAttempts: (attempts) => ({ attemptCount: attempts.length }),
    sameAttempt: (state, turn, step) => state.turn === turn && state.step === step,
    messageRoute: () => ({ provider: 'mock', model: 'fixture' }),
  })
}

const usage = { inputTokens: 10, outputTokens: 5, totalTokens: 15 }
const start = [
  { type: 'turn/start', data: { turn: 1 } },
  { type: 'step/start', data: { turn: 1, step: 1 } },
]
const attempt = {
  type: 'assistant/attempt',
  data: { turn: 1, step: 1, stream: [{ type: 'usage', usage }] },
}
const message = {
  type: 'assistant/message',
  data: { turn: 1, step: 1, usage, stream: [], message: recoveredMessage() },
}
const stepEnd = { type: 'step/end', data: { turn: 1, step: 1 } }
const turnEnd = { type: 'turn/end', data: { turn: 1, reason: { kind: 'error' } } }

test('Web client: baseline completed failure attempt has valid usage lifecycle', () => {
  const fold = loadRealWebTurnUsageFold()
  assert.equal(fold([...start, attempt, stepEnd, turnEnd])?.attemptCount, 1)
})

test('Web client: adding assistant/message after settled attempt, before step/end, invalidates lifecycle', () => {
  const fold = loadRealWebTurnUsageFold()
  assert.equal(fold([...start, attempt, message, stepEnd, turnEnd]), undefined)
})

test('Web client: adding assistant/message after turn/end also invalidates lifecycle', () => {
  const fold = loadRealWebTurnUsageFold()
  assert.equal(fold([...start, attempt, stepEnd, turnEnd, message]), undefined)
})
