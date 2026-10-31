# Implementation 02 — verification register

## Baseline

- User target: Windows DSH Desktop 0.2.1-rc.2, bundled build 332895e0f7c9d4dbfb29729f5eb367fa263ff986.
- Official Git tag: dsh-v0.2.1-rc.2, commit 687f282e8625c6b8d11ff58211a90524be2e4317.
- Source patch: _upstream/deepseek-harness, independent Git branch feat/20261030-01-response-recovery.
- Production executable / DSH Profile / original Session / dsh-purge / Magpie: not modified.
- Private real Session content and reasoning: not read or copied.

## Session semantics

The patched core admits assistant/message.recovery with a branded sourceAttemptSeq only after a terminal failed turn. It checks a previous assistant/attempt in the same turn and step, compares every recovered text block with the actual assembled stream, and rejects duplicate Recovery records. The message event itself contains the provenance, so there is no two-write marker transaction. Session creation from existing events also validates Recovery records.

Recovery is still an assistant/message on the native Surface: deriveMessages includes it without plugin-specific projections, including after plugin removal, as long as the host core supports the event field. The old JSONL Session Format Version remains 4. An unpatched rc.2 reader has not been approved for Sessions containing Recovery (Web Usage invalid); do not claim safe downgrade.

## Lifecycle and retries

Agent Loop waits for agent/failed-turn-settled after turn/end is committed, and before the turn driver can start another turn. Only terminal error outcomes trigger it. Original errors are preserved if a plugin listener rejects. The callback may append a new Session event outside session/event publication reentrancy.

Normal success and recovered attempts remain distinct. The dsh-purge silent-retry sequence already violates the installed Token Meter usage state machine at its second assistant/attempt. Recovery does not cure it, and the new marker is ignored for model-attempt token accounting rather than counted twice.

## Test results

- Original installed rc.2 Session/Web extracted-function tests: 5 PASS.
- New plugin/core/UI-isolated tests: 15 PASS.
- Total after patch: 20 PASS, 0 FAIL. Executed via npm test on the investigated Windows host; no live provider calls.
- Syntax check: seven changed core TypeScript modules passed Node experimental type-transform parse checks.
- Core updated Session module directly imported from official tag source with isolated installed runtime dependencies.
- Core updated Token Meter loaded from the official source and tested directly.
- Plugin callback tested with scoped event mock and actual patched Source Session.
- Session reload and forged replay, provenance validation, source mismatch, duplicate append, success/cancellation, reasoning/tool-only, three write timings, stable tie-break, and Turn 29/30 text order covered.
- Assistant-step and Turn Tail definitions directly exercised from patched official UI source: 2 PASS. This is not a browser renderer acceptance test.
- Original, patched, and plugin-only module resolution tests used a development preload without writing or leaving links inside the production installation.
- npm pack --dry-run: package metadata inspected; no actual publishing.

## Unverified gates

- Full official TypeScript compilation and Vitest: NOT VERIFIED. pnpm offline --frozen-lockfile --ignore-scripts aborted due to missing pre-existing mirror metadata; the failure did not modify production.
- Native browser UI after a failed turn, scrolling, virtualized nodes, Turn Tail and reload: NOT VERIFIED. The UI source patch is reasoned and syntax-checked only.
- Actual boot of a paired isolated Cordis host and loader install/enable/disable/uninstall: NOT VERIFIED. A mock context registered/invoked the plugin callback; this is not the same as a loader test.
- Full request assembler after Recovery and actual Agent Loop hook execution using a synthetic provider: NOT VERIFIED. Ordering is source-reviewed and the session fold is verified.
- Complete official SDK snapshots / release-policy gates: NOT VERIFIED.
- Public DSH acceptance of PR / future release: NOT VERIFIED.

## Release decision

Implementation remains experimental. Do not publish as fully operational, install on unmodified 0.2.1-rc.2, mutate production Sessions, or claim browser acceptance. Document the core capability version rather than guessing which future semver contains it. The package is private until the above gates close.

## Integration Acceptance 01 — final verification amendment (2026-10-30)

Toolchain and dependency installation:
- Node.js 24.15.0, pnpm 11.28.5 per official packageManager.
- Official pinned dependency installation in isolated upstream checkout: PASS. Original sparse checkout required missing patches, native/system, website and snapshots.
- Official pnpm run typecheck: PASS. Later aggregate tsc -b tsconfig.host.json tsconfig.client.json: PASS after directly fixing new test-only diagnostics.
- Official pnpm run build:artifacts: PASS. After Agent Loop wake fix, official targeted tsc -b and tsdown host build: PASS.
- Official targeted Vitest (Recovery Session, Token Meter, Agent Loop, Web Conversation): 4 files, 11 PASS.
- Plugin npm test: 32 PASS, 0 FAIL. Tests cover five real compiled Agent Loop scenarios, Cordis activation/uninstall/re-enable, vanilla rc.2 safe refusal, Web ordering, Session reload and Usage.
- The original five feasibility tests remain present and pass; test counts do not imply a full upstream workspace test run.

Two newly proven and fixed P0 defects:
1. A next-turn user message received during awaited terminal failure hook was left queued without an Agent wake. The failed driver rethrows after its finally and cannot claim pending work normally; the failure teardown now latches pending waking input unless the agent is disposed. A red test on the real Agent Loop became green following recompilation.
2. A Recovery message durably appended after turn/end initially rendered its Assistant node behind Turn Tail. The recovered Assistant display anchor now follows the already closed Step location while the Session event retains its true sequence. Native ConversationNodeAssembler tests verify one Assistant row, ordering, interrupted/error state and reload consistency.

Additional test/metadata fixes:
- Plugin source now includes a TypeScript declaration required by the official host compiler.
- Recovery seed-corruption test and Web Turn Tail test preserve proper event type narrowing.
- Removed misleading engines.dsh >=0.2.1-rc.2 claim. The runtime Recovery capability check is mandatory; official availability is not assumed.

Remaining gates:
- BROWSER_NOT_VERIFIED: isolated full-page browser rendering, refresh, scroll and interactive behavior have not been executed. Native Web conversation replay is verified.
- DSH_EXTERNAL_LOADER_NOT_VERIFIED: actual Cordis Context activation/disposal passed, but EntryTree/plugin manager loading through an isolated DSH Profile has not been verified.
- DSH upstream PR acceptance/release NOT VERIFIED. Cannot install publicly into unmodified DSH 0.2.1-rc.2.
- No full workspace Vitest suite or SDK snapshot gate was executed. Silent dsh-purge Retry Usage invalid remains an independent known issue.
- All fake messages are synthetic; no production DSH or private Session was modified.

## Git Closure 01 — V4 native format regression

The earlier Implementation 02 and Integration Acceptance 01 suites predate discovery of a **real additional V4 persistence validator gate**. Valid recovery at the Session level did not ensure admission by the native V4 relationships validator. The user reported success with an installed V4 patch when restoring Turn 34 (sourceAttemptSeq=732, 3,753 visible characters), including disk reload and model-visible deriveMessages. The report is not a new read of private production data in this task.

This closure extends only packages/session/session-format-v3-to-v4/src/relationships.ts. Valid recovery must be a Surface append following a terminal failed turn, carry sourceAttemptSeq referencing a genuine earlier same-turn/same-step assistant/attempt, reproduce its original visible streamed text, and be the sole recovered assistant in the turn. Ordinary late assistant messages, fabricated text, reasoning-only or tool-only sources, and duplicates remain invalid. V4 remains version 4. The historical V4 reader without this patch cannot be relied upon to reload recovered Sessions.

Focused tests are in packages/session/session-format-v3-to-v4/tests/relationships.spec.ts. The synthetic physical file roundtrip exercises catalog decoding and Session.fromRestore, not the real production JSONL persistence or private Turn 34 replay. Only bounded V4 and directly impacted module tests are required here; the earlier 43/43 report is historical and is not represented as rerun by this closure.

Git safety: .local-deploy/, _upstream/, .reference/, node_modules/, log, backup, JSONL and credential patterns are excluded by the tracked plugin .gitignore rather than relying only on local info/exclude. Public release remains blocked by official core distribution and full browser/external loader acceptance.

### Git Closure 01 focused regression result (2026-10-31)

The native V4 format patch was independently verified against five Recovery cases A-E in the synthetic format fixture, including a physical JSON file round-trip through the V4 Catalog and Session.fromRestore. Neither private Turn 34 text nor production Session files were used.

- Official focused command: node_modules/.bin/vitest.cmd run packages/session/session-format-v3-to-v4/tests/relationships.spec.ts packages/session/session-format-v3-to-v4/tests/validation.spec.ts packages/core/session/tests/recovery.spec.ts
- Result: 3 test files PASS, 78 tests PASS, 0 FAIL (including 5 newly added V4 Recovery cases).
- Typecheck: node node_modules/typescript/bin/tsc -b packages/session/session-format-v3-to-v4/tsconfig.json packages/core/session/tsconfig.json --pretty false — PASS.
- Version remains V4; no extra dependencies or package version upgrades.
- Source and test changes are in the separate uncommitted upstream checkout. Only previous synthetic tests were rerun as needed; no new browser E2E or full workspace integration suite was run.
- The official upstream origin remains the original vendor repository and is NOT the desired personal Fork push destination. The plugin repository has no remote. No GitHub resources were created or pushed.
