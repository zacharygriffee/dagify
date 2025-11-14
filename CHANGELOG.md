# Changelog

## [Unreleased]

## [2.0.3]
- Added `createQueuedNode` to serialize asynchronous node recomputations and provide deterministic ordering for promise/observable handlers.
- Introduced optional `maxQueueLength`, `overflowStrategy`, and `onOverflow` controls so queued nodes can apply bounded buffering and custom overflow policies.
- FRP helpers now ignore `NO_EMIT` sentinel emissions by default and expose a `{ triggerOnNoEmit: true }` option for cases where projectors must run on those values.
- Fixed a regression where deep nodes stopped emitting when nested object/array properties were mutated in place; nodes now keep structural snapshots so update/set and computed recomputations re-trigger as documented.

## [2.0.0]
- Streamlined the core API around FRP primitives (`map`, `filter`, `combine`, `merge`, `switchLatest`, `from`, `createStore`) and exposed a `.stream` facade on every node.
- Introduced `dagify/effect` with helpers (`command`, `bridge`, `sink`, `fromEvent`, `trigger`, `dispatcher`) to consolidate side-effectful nodes.
- Added `dagify/internal/*` subpaths for advanced utilities (encoding, types, key management) to keep the public surface focused.
- Updated documentation, examples, and migration guides to reflect the new FRP-first workflow.
- Expanded test coverage for FRP helpers, effect helpers, encoding guards, and activity-threshold scheduling.
