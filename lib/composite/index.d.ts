import type { CompositeNode, DagifyNode } from "../../types/shared";

export type { CompositeNode, DagifyNode } from "../../types/shared";

export declare function createComposite<T extends DagifyNode<any>[] | Record<string, DagifyNode<any>>>(
  nodes: T
): CompositeNode<any, T>;
