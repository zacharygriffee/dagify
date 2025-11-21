import type { BridgeNode, DagifyNode, NodeConfig } from "../../types/shared";

export type { BridgeNode, DagifyNode, NodeConfig } from "../../types/shared";

export declare function createBridgeNode<T = unknown>(
  input: DagifyNode<any>,
  output: DagifyNode<T>,
  config?: NodeConfig<T>
): BridgeNode<T>;
