import type { DagifyNode, DependencyCollection, NodeConfig } from "../../types/shared";

export type { DagifyNode, DependencyCollection, NodeConfig } from "../../types/shared";

export declare function createSinkNode<T = unknown>(
  fnOrValue: ((...args: any[]) => T) | T,
  dependencies?: DependencyCollection,
  config?: NodeConfig<T>
): DagifyNode<T>;
