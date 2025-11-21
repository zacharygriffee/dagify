import type { Observable } from "rxjs";
import type {
  DagifyNode,
  DagifyNodeFactory,
  DependencyCollection,
  NodeConfig,
} from "../../types/shared";

export type {
  DagifyNode,
  DagifyNodeFactory,
  DependencyCollection,
  NodeConfig,
} from "../../types/shared";

export type ReactiveNode<T = unknown> = DagifyNode<T>;

export declare const NO_EMIT: unique symbol;

export declare function createNode<T = unknown>(
  fnOrValue:
    | ((...args: any[]) => T)
    | T
    | Observable<T>
    | Promise<T>,
  dependencies?: DependencyCollection | NodeConfig<T>,
  config?: NodeConfig<T>
): DagifyNode<T>;

/**
 * Create a node that processes dependency changes sequentially, ensuring async work finishes in order.
 */
export declare function createQueuedNode<T = unknown>(
  fn:
    | ((...args: any[]) => T)
    | ((...args: any[]) => Promise<T>)
    | ((...args: any[]) => Observable<T>),
  dependencies?: DependencyCollection,
  config?: NodeConfig<T>
): DagifyNode<T>;

/** Collapse multiple updates in a single tick into one emission. */
export declare function batch(fn: () => void): void;

export { dispatcher } from "../dispatcher/index.js";

/**
 * Create a node that only emits when the reference changes (`===`), skipping structural comparisons.
 */
export declare function createReferenceNode<T = unknown>(
  value: T,
  dependencies?: DependencyCollection,
  config?: NodeConfig<T>
): DagifyNode<T>;

export declare function nodeFactory<T = unknown>(
  value: T | ((...args: any[]) => T),
  depsOrActivator?:
    | DependencyCollection
    | ((id: string | number, node: DagifyNode<T>) => void)
    | number,
  max?: number
): DagifyNodeFactory<DagifyNode<T>>;

export declare function isDagifyNode(value: unknown): value is DagifyNode;

export declare function identity<T>(value: T): T;

export declare function ensureNode<T>(
  value: T | DagifyNode<T>,
  config?: NodeConfig<T>
): DagifyNode<T>;

export declare function setFailFastPredicate(
  predicate: ((error: unknown) => boolean) | null
): void;

export declare function setFailFastEnabled(enabled: boolean): void;

export declare function defaultFatalErrorPredicate(error: unknown): boolean;

export * from "./key-management/index.js";
