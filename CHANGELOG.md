# Changelog

## 0.1.0-rc.1 (unreleased)

- Standalone host Cordis plugin and deterministic failed-attempt selection.
- Paired DSH core Recovery message provenance, final failure hook, Usage exclusion and interrupted Chat presentation.
- Synthetic source, duplicate, reload, retry, cancellation and Turn 29/30 regression coverage.
- Original architecture evidence and original five tests preserved.
- Not publishable until official core and browser integration gates are met.

## Integration Acceptance 01 (2026-10-30, unreleased)

- Official pinned pnpm install, Typecheck and Build passed in isolated official source.
- Real compiled Agent Loop with local mock provider: five cases passed including next-turn request context, silent retry success/failure, throwing Hook and slow Hook.
- Fixed awaited-failure Hook queued follow-up wakeup in core agent.ts; confirmed failure then green using the real loop.
- Fixed recovered Assistant rendering after turn/end: the node now sorts before Turn Tail; native ConversationNodeAssembler reload test passed.
- Real Cordis activation, disposal, re-enable, reload and vanilla rc.2 refusal passed.
- Added package TypeScript declaration; removed misleading vanilla rc.2 engines.dsh claim.
- Final plugin suite 32 PASS; official targeted Vitest 11 PASS across 4 files.
- Still unreleased: actual browser end-to-end and DSH external plugin-manager installation have not been verified. Official Recovery-capable core distribution remains required.

## Git Closure 01 (unreleased)

- Included strict V4 relationship admission for post-turn failed-attempt Recovery, without bumping Session Format Version.
- Matched the Session core's recovery provenance and visible text requirements; kept the ordinary completed-turn message prohibition and single-recovery invariant.
- Added scoped V4 tests for terminal recovery, synthetic physical file round-trip and model-visible reload, forged/duplicate sources, and legacy Session compatibility.
- User-reported production Turn 34 recovery: sourceAttemptSeq 732, 3,753 characters, successful disk reload; no private text included and not independently repeated in this closure.
- Vanilla 0.2.1-rc.2 remains incompatible; official DSH release and browser/external plugin-manager acceptance remain pending. No npm release.
