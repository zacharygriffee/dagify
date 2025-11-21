import type {
  DependencyCollection,
  NodeConfig,
  ShallowReactiveNode,
} from "../../types/shared";

export type {
  ShallowReactiveNode,
  DependencyCollection,
  NodeConfig,
} from "../../types/shared";

export declare function createShallowNode<T = unknown>(
  fnOrValue: ((...args: any[]) => T) | T,
  dependencies?: DependencyCollection,
  config?: NodeConfig<T>
): ShallowReactiveNode<T>;
