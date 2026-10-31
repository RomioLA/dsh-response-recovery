# DSH Response Recovery / DSH 回复防丢失

**Status: Experimental. Source published on GitHub; ordinary DSH installation has not been validated. Not listed in the community market.**

DSH Response Recovery preserves text already visibly streamed before a terminal upstream failure. The content becomes a durable assistant message in the original conversation. It is available through the Recovery-aware core's native Session history (`deriveMessages`), including after a supported reload; a specific later model request includes it only if that request uses the same Session and context assembly retains the recovered message (rather than truncating, summarizing, or otherwise excluding it). It does not change provider finish reasons, filter results, previous attempts, or original turn errors.

## Compatibility

The plugin requires a Recovery-aware DSH core exposing `RESPONSE_RECOVERY_CONTRACT_VERSION=1`, including the Session extension, awaited Agent Loop failure hook, Token Meter and Web projection changes, and the V4 relationship validator. Vanilla DSH Desktop 0.2.1-rc.2 does **not** provide those capabilities; the plugin refuses to activate without the contract. No official compatible release has been identified. The required core patch is published in [RomioLA/deepseek-harness](https://github.com/RomioLA/deepseek-harness/tree/feat/20261030-01-response-recovery), branch `feat/20261030-01-response-recovery`, commit `be3d6eef82408807d4d2c6dd826f08632d937487`. The plugin source is published in [RomioLA/dsh-response-recovery](https://github.com/RomioLA/dsh-response-recovery).

The paired core patch is derived from official `dsh-v0.2.1-rc.2` source and is committed in the personal fork linked above; it is not merged or released by the official DSH project. A new stable, awaited agent/failed-turn-settled lifecycle event fires after the failed turn/end is persisted and before the driver can process another turn. The core recognizes optional assistant/message.recovery metadata, validates the actual failed attempt and exact streamed text, rejects duplicates, and excludes recovered messages from provider Usage. Web Chat treats a recovered assistant message as interrupted.

The original Session Format Version and the event type remain unchanged. Legacy messages remain native. Historical recovery remains model-visible if this plugin is disabled, provided the upgraded core remains installed. Downgrading a Session with recovery to vanilla rc.2 is not guaranteed to preserve correct Web Usage presentation.

## Recovery policy

Only the final failed step is eligible. Among its failed attempts, choose the most visible text; ties use the earliest attempt sequence. Do not concatenate attempts, recover hidden reasoning, execute incomplete tool calls, grade prose using AI, or run provider requests. A message already recovered for the turn prevents further recovery. Content must equal the source stream exactly.

Known limitation: this length-based choice does not assess semantic quality. dsh-purge-community 1.6.60 has an independent Usage issue with silent retries without official retry markers. This plugin does not fix it or claim those statistics are accurate; it does not add further token charges.

## Installation and verification

**Do not install on unmodified DSH 0.2.1-rc.2.** Experimental source-based use requires (1) an isolated, locally built and running DSH host incorporating the exact Recovery-aware fork changes above, including the V4 validator; (2) the plugin source checkout and its declared peer packages resolvable in that host; and (3) an isolated test Profile configured to load this bundle's `cordis.patch.yml`. The `dsh.bundle` manifest is an installation declaration, **not** a way to apply the required core patch. The package remains `private: true`, is not published to npm, and the ordinary external DSH plugin-manager/Profile install path has **not** passed full acceptance. Do not change production DSH, Profiles, or Sessions to experiment. Once activated in a compatible host, the plugin runs automatically without a UI or manual command.

For experimental verification, use a synthetic streamed assistant answer followed by a terminal provider error; inspect the recovered Chat message, a Session reload, and the next mock model request. No sensitive production conversation is required. Disabling the plugin's Cordis entry stops future recovery when the plugin is unloaded; removing the bundle from the test Profile removes its automatic loading. If a Cordis row was added manually, remove that row separately. Unloading or uninstalling this plugin does **not** delete previously saved assistant history. Existing Recovery messages remain model-visible only while the installed core and V4 reader support Recovery; a downgrade to vanilla rc.2 can break reading such Sessions.

## Development and evidence

Run `npm test` in this repository for the original feasibility and targeted Recovery regression tests. Some development tests rely on local source/runtime fixtures and may require their test prerequisites. See docs/VALIDATION.md and docs/UPSTREAM_PR.md. The historical original report is preserved at docs/ARCHITECTURE_BLOCKER.md.

**Recovery-aware core Typecheck, Build, targeted Vitest and real Agent Loop/Cordis activation passed in isolated tests. Full browser E2E and external DSH plugin-manager/Profile installation remain NOT VERIFIED.** These are not ordinary-user installation acceptance. The package remains private; market submission is only being prepared, not approved.

## Privacy and security

Only already streamed text is written to the Session. Reasoning, credentials, system prompts and unfinished tool calls are not copied. Retained text remains in ordinary Session storage and follows the same privacy and deletion considerations as other assistant history. This plugin never bypasses provider content filtering or silently alters error events.


## V4 native persistence requirement (Git Closure 01)

DSH Session Format Version 4 needs the companion Recovery-aware relationship validator in addition to the Session, Agent, Token Meter, and Web changes. A recovery message is a native assistant/message appended *after* a terminal failed turn. The V4 patch limits that exception to one exact visible-text copy from a same-turn/same-step assistant/attempt preceding a failed turn/end; it rejects forged sources, reasoning/tool-only text, duplicates and late ordinary assistant messages. The Session Format Version remains 4.

The user reported an actual local production recovery of Turn 34 with sourceAttemptSeq=732 and 3,753 visible characters using the official persistence API, followed by successful disk reload and deriveMessages. This is historical user-reported acceptance evidence, **not** a reproduction on private Session data during Git Closure 01; the original text is not included.

**Distribution remains blocked for ordinary DSH users:** an officially supported Recovery-capable DSH build is not available, and the V4 native format patch is required. Vanilla 0.2.1-rc.2 is unsupported. Downgrading a Session with Recovery to a vanilla V4 validator is not guaranteed to work. Plugin and core source are publicly available on GitHub, but the plugin is still private on npm and has not passed ordinary installation acceptance.
