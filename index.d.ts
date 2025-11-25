/** Core node creation helpers (stateful, computed, queued, reference). */
export { createNode, createQueuedNode, createReferenceNode, batch, NO_EMIT } from "./lib/node/index.js";
export type { DagifyNode, DagifyNodeFactory, DependencyCollection, NodeConfig, ReactiveNode } from "./lib/node/index.js";

/** Shallow comparison nodes for reference-sensitive updates. */
export { createShallowNode } from "./lib/shallow-node/index.js";
export type { ShallowReactiveNode } from "./lib/shallow-node/index.js";

/** Graph creation and traversal utilities. */
export { createGraph } from "./lib/graph/index.js";
export type {
  ReactiveGraph,
  GraphEdge,
  GraphTraversalOptions,
  NodeReference,
} from "./lib/graph/index.js";

/** Aggregate multiple nodes into structured snapshots. */
export { createComposite } from "./lib/composite/index.js";
export type { CompositeNode } from "./lib/composite/index.js";

/** Triggers and operators for flow control. */
export { createTrigger, trigger } from "./lib/trigger/index.js";
export {
  takeUntilCompleted,
  diffOperator,
} from "./lib/operators/index.js";
export type {
  DiffOperatorOptions,
  ArrayDiff,
} from "./lib/operators/index.js";

/** FRP helpers that accept nodes or observables and return Dagify nodes. */
export {
  map,
  filter,
  combine,
  merge,
  switchLatest,
  from,
  createStore,
  invokeOnNode,
} from "./lib/frp/index.js";
export type { FrpNodeOptions, StreamLike } from "./lib/frp/index.js";

/** Stream/async-iterable interop helpers. */
export {
  fromAsyncIterable,
  fromReadableStream,
  toAsyncIterable,
  toReadableStream,
} from "./lib/streams/index.js";
export type {
  FromAsyncIterableOptions,
  ToAsyncIterableOptions,
  ToAsyncIterableOverflowInfo,
  ToReadableStreamOptions,
} from "./types/shared";
