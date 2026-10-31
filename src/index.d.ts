import type { Context } from '@deepseek-ai/cordis'

/** Cordis plugin identity for the DSH failed-attempt Recovery extension. */
export declare const name: 'dsh-response-recovery'

/** Required DSH services available before the plugin becomes active. */
export declare const inject: readonly ['agents', 'sessions']

/** Register one scoped awaited failed-turn listener, owned by the Cordis fiber. */
export declare function apply(ctx: Context): void
