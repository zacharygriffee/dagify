import type { Observable } from "rxjs";
import type { DagifyNode, NodeConfig } from "../../types/shared";

export interface FrpNodeOptions<T = unknown> {
  initialValue?: T;
  config?: NodeConfig<T>;
  nodeConfig?: NodeConfig<T>;
  triggerOnNoEmit?: boolean;
}

export type StreamLike<T> = DagifyNode<T> | Observable<T>;

export declare function map<T, TResult>(
  source: StreamLike<T>,
  projector: (value: T) => TResult,
  options?: FrpNodeOptions<TResult>
): DagifyNode<TResult>;

export declare function filter<T>(
  source: StreamLike<T>,
  predicate: (value: T) => boolean,
  options?: FrpNodeOptions<T>
): DagifyNode<T>;

export declare function combine<T = unknown>(
  sources:
    | StreamLike<any>[]
    | Record<string, StreamLike<any>>,
  projector?: (...values: any[]) => T,
  options?: FrpNodeOptions<T>
): DagifyNode<T>;

export declare function merge<T>(
  sources: StreamLike<T> | StreamLike<T>[],
  options?: FrpNodeOptions<T>
): DagifyNode<T>;

export declare function switchLatest<T, TResult = T>(
  source: StreamLike<T>,
  projector?: (value: T) => StreamLike<TResult>,
  options?: FrpNodeOptions<TResult>
): DagifyNode<TResult>;

export type FloorAsyncInput<T = unknown> =
  | T
  | Promise<FloorAsyncInput<T>>
  | Observable<FloorAsyncInput<T>>
  | DagifyNode<FloorAsyncInput<T>>
  | (() => FloorAsyncInput<T> | Promise<FloorAsyncInput<T>>);

export declare function floorAsync<T = unknown>(
  input: FloorAsyncInput<T>
): Observable<T>;

export declare function from<T>(
  input: StreamLike<T> | Promise<T> | T,
  options?: FrpNodeOptions<T>
): DagifyNode<T>;

export declare function createStore<T>(
  initialValue: T,
  config?: NodeConfig<T>
): DagifyNode<T>;

export declare function invokeOnNode<T, K extends string | symbol>(
  source: StreamLike<T>,
  methodName: K,
  ...args: unknown[]
): DagifyNode<T>;
