/**
 * Select one actually emitted text prefix from the final failed turn.
 * Longest visible text wins; ties use the earlier attempt sequence.
 * Reasoning and tool calls are never copied into the returned content.
 * @param {readonly object[]} events - Original turn events, chronological.
 * @param {number} turn - Failed turn number.
 * @param {(stream: readonly object[]) => {interruptedBlocks(): readonly object[]}} assemble - Native DSH assembler.
 * @returns {{sourceAttemptSeq:number, step:number, content: object[]}|null}
 */
export function selectRecovery(events, turn, assemble) {
  const terminal = events.findLast(e => e.type === 'turn/end' && e.data.turn === turn)
  if (terminal?.data.reason?.kind !== 'error') return null
  if (events.some(e => e.type === 'assistant/message'
    && e.data.turn === turn && e.data.recovery !== undefined)) return null
  const attempts = events.filter(e => e.type === 'assistant/attempt' && e.data.turn === turn)
  if (attempts.length === 0) return null
  const step = attempts.at(-1).data.step
  const inStep = attempts.filter(e => e.data.step === step)
  if (events.some(e => e.type === 'assistant/message' && e.data.turn === turn
    && e.data.step === step && e.data.recovery === undefined)) return null
  let chosen = null
  for (const attempt of inStep) {
    try {
      const content = assemble(attempt.data.stream).interruptedBlocks()
        .filter(block => block.type === 'text' && block.text.trim().length > 0)
      const length = content.reduce((sum, block) => sum + block.text.length, 0)
      if (length > 0 && (chosen === null || length > chosen.length)) {
        chosen = { sourceAttemptSeq: attempt.seq, step, content, length }
      }
    } catch {
      // A malformed/incomplete original stream cannot become a recovery.
    }
  }
  if (chosen === null) return null
  return { sourceAttemptSeq: chosen.sourceAttemptSeq, step: chosen.step, content: chosen.content }
}

/** Read only the completed turn's events using public Session eventAt/seq APIs. */
export function turnEvents(session, turn) {
  const found = []
  for (let seq = session.seq - 1; seq >= 0; seq--) {
    const event = session.eventAt(seq)
    if (!event) continue
    found.push(event)
    if (event.type === 'turn/start' && event.data.turn === turn) break
  }
  found.reverse()
  return found[0]?.type === 'turn/start' && found[0].data.turn === turn ? found : []
}
