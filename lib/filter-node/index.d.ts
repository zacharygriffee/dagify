import type {
  DagifyNode,
  DependencyCollection,
  NodeConfig,
} from "../../types/shared";

export type {
  DagifyNode,
  DependencyCollection,
  NodeConfig,
} from "../../types/shared";

export declare function createFilterNode<T = unknown>(
  predicate: (value: T) => boolean,
  dependencies?: DependencyCollection,
  config?: NodeConfig<T>
): DagifyNode<T>;
