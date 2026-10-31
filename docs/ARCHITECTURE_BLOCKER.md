# DSH Response Recovery: architecture review

Verdict: PLUGIN_ARCHITECTURE_BLOCKED for DSH Desktop 0.2.1-rc.2.

This directory contains isolated feasibility tests and evidence, NOT a
working Cordis plugin or a release candidate. Production DSH and real
Sessions remain unchanged.

## Verified evidence

1. The installed Session accepts a late assistant/message after a failed
   turn/end. Its deriveMessages() then includes that assistant text.
   Session acceptance does not prove a valid Web UI lifecycle.
2. Installed Web client function deriveTurnTokenUsage(events) changes state
   from open to finishClosed when assistant/attempt settles. A later
   assistant/message in the same step requires state.kind === open and is
   therefore rejected. An assistant/message after turn/end is also invalid
   due to the sawEnd guard. A completed failure without recovery is valid
   in the same test.
3. Session Surface event types are a fixed set: system/message,
   developer/message, user/message, assistant/message and tool/result.
   assistant/attempt and new plugin-owned event types are log-only.
   registerMessageProjection modifies already existing surface messages;
   it does not create an assistant message from a custom record.
4. A Client UI plugin may add rendering, but alone it cannot make a
   custom event model-visible or repair builtin usage lifecycle after
   writing a late assistant/message.

The installed dsh-session/lib/index.js has a dshpurge backup. The original
backup contains the same fixed Surface event-type list. The observed
client-ui-chat/lib/client.js has no matching dshpurge backup.

## Reproduction

Run npm test on the investigated machine. Tests only use neutral examples
and do NOT open real Sessions or call a provider.

tests/rc2-contract.test.mjs verifies:
- Session late append and derived assistant history
- Surface eligibility exclusion for plugin record / assistant attempt
- Native Web usage fold baseline accepted
- Native Web usage fold invalid after same-step late assistant message
- Native Web usage fold invalid after turn/end append

The Web fold is the actual function extracted from the installed client
bundle, with helper normalizers stubbed using neutral usage. This is a
focused lifecycle test, not a rendered browser integration test.

Other machines can set DSH_MODULES to the absolute path of their installed
node_modules/@deepseek-ai folder.

## Minimal upstream extension proposal

Recommended: introduce a core-recognized, durable assistant/recovery event
with these properties:

1. It has assistant-role Surface semantics and a logged sourceAttemptSeq,
   selectable only for a terminal failed turn.
2. The provider failure and the original failed attempts stay intact;
   no finish reason, Turn/Step or Retry event is falsified.
3. Web renders it as recovered content outside attempt settlement, and
   excludes it from provider attempt token usage aggregation.
4. Reload and uninstallation preserve history independently of the plugin.
5. Recovery identity is source-based and idempotent across crashes.
6. Regression tests cover silent retry, retry success, user cancellation,
   multiple attempts, duplicate notifications, reload and next-turn context.

A second, more invasive option is an upstream Agent Loop hook before
durable attempt settlement. It also needs explicit handling of silent
retry and error-preserving final settlement.

Without such an upstream mechanism, do not append to a closed attempt,
invent retry events or step/turn boundaries, patch the UI DOM, rewrite a
previous assistant message, or claim that Client-only text persistence
meets the model-context requirement.

## Gate assessment

- Session model visibility: verified, isolated.
- Web token-usage lifecycle with late append: fails.
- Complete Web render/reload: NOT VERIFIED.
- Live next-turn recovery: NOT VERIFIED.
- Automatic/silent retry recovery: NOT IMPLEMENTED.
- Installable Cordis plugin: NOT IMPLEMENTED.
- Release candidate: NO.

## Scope and sources

DSH runtime read-only:
E:\AI\DeepSeek Harness\resources\app\dsh\node_modules\@deepseek-ai

Desktop version: 0.2.1-rc.2.
Public source reference clone .reference/dsh was at
ce7073d51254c26cd63b22a60835b8f948deb447.
Desktop build commit 332895e0f7c9d4dbfb29729f5eb367fa263ff986
could not be fetched directly from public GitHub. Evidence instead
uses actually installed rc.2 modules.

No actual provider request, original user Session, prompt, reasoning,
token or other sensitive content was read or modified.
