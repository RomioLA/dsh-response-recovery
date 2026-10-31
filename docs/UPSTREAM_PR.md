# Proposed upstream DSH pull request (not submitted)

## Title

feat: retain failed-attempt streamed text as durable assistant history through a verified Recovery message

## Base

Official deepseek-ai/deepseek-harness at dsh-v0.2.1-rc.2, commit 687f282e8625c6b8d11ff58211a90524be2e4317. The packaged Desktop build reports a different build commit; compare runtime behavior rather than assuming it matches the tag byte-for-byte.

## Changes by file

1. packages/core/session/src/types.ts — add optional assistant/message.recovery provenance with branded sourceAttemptSeq and a closed upstream-failure reason literal.
2. packages/core/session/src/index.ts — expose runtime ability RESPONSE_RECOVERY_CONTRACT_VERSION=1; validate source attempt, matching coordinates, terminal failed turn, identical visible streamed text, and single Recovery when appending and importing Session events.
3. packages/core/agent/src/runtime-types.ts — document one new serial agent/failed-turn-settled callback after terminal failure.
4. packages/core/agent-loop/src/agent.ts — await that callback after committing turn/end while preserving original error if listener fails.
5. packages/llm/token-meter/src/turn-usage.ts — ignore a Recovery transcript event for additional provider attempts and charges, regardless of its position relative to turn/end.
6. packages/client/ui-chat/src/client/conversation-nodes/assistant.ts — use existing native interrupted message presentation on Recovery.
7. packages/client/ui-chat/src/client/conversation-nodes/turn-tail.ts — keep branch unavailability for interrupted restored text.
8. packages/core/session/tests/recovery.spec.ts — test native source validation, idempotency, and seed import.
9. packages/llm/token-meter/tests/recovery.spec.ts — test original Usage totals and existing silent Retry conflict.

## Compatibility

No new Session Event Type. No Session Format Version bump is proposed. The old reader can parse the additive metadata, but its Web token-meter is not Recovery-aware, so safe downgrade is not promised. The patch is additive for ordinary assistant/message and does not edit provider finish codes or actual attempt settlements. The plugin's minimum capability is version 1, not simply a semver lower bound.

## Independent plugin

Package dsh-response-recovery, separate project under C:/codex/dsh-response-recovery. It listens only to terminal failed-turn settlement, chooses the longest actual visible text prefix within the final failed step, appends native assistant/message with Recovery provenance, and delegates all Session correctness checks to core. No database, Client-only DOM patches, proxy interception, model calls, or retry-engine replacement.

## Remaining review tasks before a real PR

Run the official TypeScript/Vitest tests with the repository's pinned dependencies, extend native Agent Loop integration tests and Web conversation replay tests, update required SDK snapshots and bilingual API documentation according to AGENTS.md, and examine rollback semantics with Session Format Version 4. Verify official loader and browser integration in a non-production host. Do not submit the PR or publish until these gates are closed.

This file is planning material, not evidence that the official maintainers accepted the design.

## Integration Acceptance 01 PR amendment

- Agent Loop terminal failure completion now latches a queued next-turn wake if the user enqueued it while the awaited plugin hook was running. This prevents stranded input when the failed driver unwinds.
- The Recovery Assistant Chat node uses the closed Step anchor when recovered after turn/end, keeping it before the Turn Tail without changing the original durable message sequence.
- New official focused specs: packages/core/agent-loop/tests/response-recovery.integration.spec.ts and packages/client/ui-chat/tests/response-recovery-order.client.spec.ts.
- The plugin also has real runtime tests in tests/agent-runtime.test.mjs and tests/cordis-runtime.test.mjs plus isolated Usage and capability checks.
- Final independent host/client TypeScript aggregate, official artifact build, 11 upstream focused Vitest tests, and 32 plugin tests passed.
- Browser E2E, external DSH plugin-manager installation, full SDK snapshot gates, and official core release remain outstanding.

## Git Closure 01 — V4 native relationship change (2026-10-31)

**Why this is required:** The earlier implementation only extended Session acceptance. The released V4 persistence relationship validator still rejected an assistant/message appended after turn/end. This was exposed by the user-reported real Turn 34 restoration scenario.

**Source patch:** packages/session/session-format-v3-to-v4/src/relationships.ts. It conditionally admits a verified Recovery after terminal turn/end error, while rejecting ordinary late assistant messages. It checks actual source attempt sequence, identical turn/step, error terminal after the source, visible-text block equality (including packed text chunks and raw deltas), and uniqueness. Reasoning-only and unfinished tool content cannot become recovery text. There is no new event type or Session Format Version.

**Focused test addition:** packages/session/session-format-v3-to-v4/tests/relationships.spec.ts. Cases A–E cover valid recovery, synthetic physical file round trip through the official V4 catalog and Session.fromRestore, ordinary late-message rejection, forged source/coordinate/duplicate, and legacy V4 history. The physical file fixture is synthetic and is **not** the production Session persistence store.

**Historical evidence only:** Per the user's prior report, Turn 34 (sourceAttemptSeq=732, 3,753 characters) was recovered with the official persistence API and readable after reload. This is not an independent read or retest of that private Session and no text is included.

**Important compatibility correction:** Native V4 format validation also needs the patch. The old rc.2 V4 reader will reject a post-turn Recovery message, even if its JSON field is otherwise additive; safe downgrade is not promised.

**Release boundaries:** No npm publication, Git commit, push, upstream PR or official feature acceptance is represented by this document. The current upstream checkout's origin points at the official repository; publish changes only through a confirmed personal fork.

## Git Closure 01 focused V4 test evidence

Using the official V4 Catalog and restored native Session with generated (not private) attempt text, relationships.spec.ts plus validation.spec.ts and Session recovery.spec.ts passed 78/78 across three suites. Related package TypeScript compilation passed; no Session Format version bump, new dependency, or wholesale Retry change was needed.

The safe release boundary requires both this native V4 validator and the Recovery Session/Agent/Web/Token Meter patch. Earlier reports that an unmodified rc.2 V4 reader could safely restore Recovery must not be relied upon. The user-reported Turn 34 recovery is recorded without private content. This Git closure did not touch the installed production patch or original Session.

**Git remote requirement:** the official upstream remote is for fetching official source; a separately verified personal Fork must be configured for pushing. The plugin project also requires an actual personal GitHub repository remote before push. This task does not create those repositories or publish any content.
