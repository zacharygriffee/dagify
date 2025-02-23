/**
 * Special symbol used to indicate that a node should not emit a new value.
 * When a computed function or stateful node returns NO_EMIT, the value is not updated nor emitted.
 */
export const NO_EMIT = Symbol("NO_EMIT");