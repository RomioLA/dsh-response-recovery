/**
 * DSH Response Recovery: durable failed-turn assistant transcript preservation.
 *
 * Requires a DSH core with the official Recovery contract + failed-turn hook.
 * Unsupported hosts fail closed before any Session write.
 */
import * as sessionApi from '@deepseek-ai/dsh-session'
import { assembleAssistantStream } from '@deepseek-ai/dsh-llm/assistant-stream'
import { createAssistantMessage } from '@deepseek-ai/dsh-llm'
import { selectRecovery, turnEvents } from './recovery.mjs'

export const name = 'dsh-response-recovery'
export const inject = ['agents', 'sessions']

/** Register one awaited terminal-failure hook; Cordis owns listener disposal. */
export function apply(ctx) {
  if (sessionApi.RESPONSE_RECOVERY_CONTRACT_VERSION !== 1) {
    throw new Error('DSH Response Recovery needs an official core with RESPONSE_RECOVERY_CONTRACT_VERSION=1')
  }
  ctx.on('agent/failed-turn-settled', async ({ agent, turn }) => {
    const session = agent.session
    const candidate = selectRecovery(turnEvents(session, turn), turn, assembleAssistantStream)
    if (!candidate) return
    const provider = typeof agent.options?.provider === 'string' && agent.options.provider
      ? agent.options.provider : 'response-recovery'
    const model = typeof agent.options?.model === 'string' && agent.options.model
      ? agent.options.model : 'retained-attempt'
    session.append('assistant/message', {
      turn,
      step: candidate.step,
      message: createAssistantMessage({
        content: candidate.content,
        source: { provider, model },
      }),
      stream: [],
      recovery: {
        sourceAttemptSeq: candidate.sourceAttemptSeq,
        reason: 'upstream-failure',
      },
    }, { surfaceOp: 'append' })
  })
}
