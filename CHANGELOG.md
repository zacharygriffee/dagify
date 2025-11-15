# Changelog

## [Unreleased]

## [3.1.0]
- Add `reference` comparison mode (`createReferenceNode` helper + `{ reference: true }` config) so nodes emit only when the top-level reference changes.
- Fix shallow/deep snapshotting so nodes can store circular structures (e.g., Corestore instances) without blowing the stack. `deepEqual` now short-circuits repeated comparisons.

## [3.0.0]
- **Breaking:** Fail-fast error handling is now enabled by default. When node computations throw programmer errors (ReferenceError, SyntaxError, TypeError, RangeError, AssertionError, ERR_ASSERTION, etc.) Dagify rethrows instead of routing them through `dependencyError$`. Opt out globally with `setFailFastEnabled(false)` or per node via `failFast: false`.
- Added `setFailFastEnabled`, `setFailFastPredicate`, and `defaultFatalErrorPredicate` exports so apps can declaratively control how fatal errors are identified.

## [2.0.4]
- Deep nodes now react to mutations performed on class instances (and other non-plain objects) by cloning their enumerable properties for comparisons, ensuring state stored in custom classes triggers subscribers when mutated in place.

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
