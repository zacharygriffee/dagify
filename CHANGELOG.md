# Changelog

## [Unreleased]
- Added `createQueuedNode` to serialize asynchronous node recomputations and provide deterministic ordering for promise/observable handlers.
- Introduced optional `maxQueueLength`, `overflowStrategy`, and `onOverflow` controls so queued nodes can apply bounded buffering and custom overflow policies.

## [2.0.0]
- Streamlined the core API around FRP primitives (`map`, `filter`, `combine`, `merge`, `switchLatest`, `from`, `createStore`) and exposed a `.stream` facade on every node.
- Introduced `dagify/effect` with helpers (`command`, `bridge`, `sink`, `fromEvent`, `trigger`, `dispatcher`) to consolidate side-effectful nodes.
- Added `dagify/internal/*` subpaths for advanced utilities (encoding, types, key management) to keep the public surface focused.
- Updated documentation, examples, and migration guides to reflect the new FRP-first workflow.
- Expanded test coverage for FRP helpers, effect helpers, encoding guards, and activity-threshold scheduling.
