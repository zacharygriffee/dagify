import type { DagifyNode } from "../../types/shared";
import type { StreamLike } from "../frp/index.js";

export declare function invokeOnNode<T, K extends PropertyKey>(
  node: StreamLike<T>,
  methodName: K,
  ...args: unknown[]
): DagifyNode<T>;
