import type { Observable } from "rxjs";
import type {
  DependencyCollection,
  ExecutionNode,
  NodeConfig,
} from "../../types/shared";

export type { ExecutionNode, DependencyCollection, NodeConfig } from "../../types/shared";

export declare function createExecutionNode<T = unknown>(
  fn: (...args: any[]) => T,
  dependencies?: DependencyCollection,
  executionStream?: Observable<unknown>,
  config?: NodeConfig<T>
): ExecutionNode<T>;

export declare function createExecutionNode<T = unknown>(
  initialValue: T,
  executionStream?: Observable<unknown>,
  config?: NodeConfig<T>
): ExecutionNode<T>;
