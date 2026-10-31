# DSH Response Recovery / DSH 回复防丢失

**Status: implemented in isolated source; not cleared for public installation.**

DSH Response Recovery preserves text already visibly streamed before a terminal upstream failure. The content becomes a durable assistant message in the original conversation and remains available to subsequent model context. It does not change provider finish reasons, filter results, previous attempts, or original turn errors.

## Compatibility

The host plugin requires the unpublished official-core capability RESPONSE_RECOVERY_CONTRACT_VERSION=1. Vanilla DSH Desktop 0.2.1-rc.2 does not provide it. The plugin deliberately refuses to activate without it.

The paired upstream source patch is under _upstream/deepseek-harness, cloned from the official dsh-v0.2.1-rc.2 tag, on a separate uncommitted branch. A new stable, awaited agent/failed-turn-settled lifecycle event fires after the failed turn/end is persisted and before the driver can process another turn. The core recognizes optional assistant/message.recovery metadata, validates the actual failed attempt and exact streamed text, rejects duplicates, and excludes recovered messages from provider Usage. Web Chat treats a recovered assistant message as interrupted.

The original Session Format Version and the event type remain unchanged. Legacy messages remain native. Historical recovery remains model-visible if this plugin is disabled, provided the upgraded core remains installed. Downgrading a Session with recovery to vanilla rc.2 is not guaranteed to preserve correct Web Usage presentation.

## Recovery policy

Only the final failed step is eligible. Among its failed attempts, choose the most visible text; ties use the earliest attempt sequence. Do not concatenate attempts, recover hidden reasoning, execute incomplete tool calls, grade prose using AI, or run provider requests. A message already recovered for the turn prevents further recovery. Content must equal the source stream exactly.

Known limitation: this length-based choice does not assess semantic quality. dsh-purge-community 1.6.60 has an independent Usage issue with silent retries without official retry markers. This plugin does not fix it or claim those statistics are accurate; it does not add further token charges.

## Installation and verification

**Do not install on unmodified DSH 0.2.1-rc.2.** After official DSH distributes a build with capability version 1, install the npm package using the supported DSH plugin mechanism and enable the dsh-response-recovery Cordis entry. The cordis.patch.yml file is an entry example. The plugin runs automatically without commands or a UI panel.

Verify with a synthetic streamed assistant answer followed by a terminal provider error. Check the original Chat, a Session reload, and a subsequent mock model request. No sensitive production conversation is required. Disable the Cordis entry to stop future recovery; uninstall the package to remove the plugin. Existing native assistant history is not deleted.

## Development and evidence

Run npm test in this repository for the five original feasibility tests plus the new Recovery tests. Development-only tests read the official cloned source and installed rc.2 runtime. See docs/VALIDATION.md and docs/UPSTREAM_PR.md. The historical original report is preserved at docs/ARCHITECTURE_BLOCKER.md.

**Official Typecheck, Build, targeted upstream Vitest and real Agent Loop/Cordis activation passed. Browser rendering and the external DSH plugin-manager/Profile install path remain NOT VERIFIED.** The package remains private pending those gates and an official core release.

## Privacy and security

Only already streamed text is written to the Session. Reasoning, credentials, system prompts and unfinished tool calls are not copied. Retained text remains in ordinary Session storage and follows the same privacy and deletion considerations as other assistant history. This plugin never bypasses provider content filtering or silently alters error events.


## V4 native persistence requirement (Git Closure 01)

DSH Session Format Version 4 needs the companion Recovery-aware relationship validator in addition to the Session, Agent, Token Meter, and Web changes. A recovery message is a native assistant/message appended *after* a terminal failed turn. The V4 patch limits that exception to one exact visible-text copy from a same-turn/same-step assistant/attempt preceding a failed turn/end; it rejects forged sources, reasoning/tool-only text, duplicates and late ordinary assistant messages. The Session Format Version remains 4.

The user reported an actual local production recovery of Turn 34 with sourceAttemptSeq=732 and 3,753 visible characters using the official persistence API, followed by successful disk reload and deriveMessages. This is historical user-reported acceptance evidence, **not** a reproduction on private Session data during Git Closure 01; the original text is not included.

**Distribution remains blocked:** an official Recovery-capable DSH release must include the V4 native format patch. Vanilla 0.2.1-rc.2 is unsupported. A downgrade of Sessions with Recovery to a vanilla V4 validator is not guaranteed to load. The plugin is not an independent fix for existing DSH installations and is still private/unpublished.
