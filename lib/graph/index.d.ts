import type {
  DagifyNode,
  GraphEdge,
  GraphTraversalOptions,
  NodeReference,
} from "../../types/shared";

export type {
  DagifyNode,
  GraphEdge,
  GraphTraversalOptions,
  NodeReference,
} from "../../types/shared";

export interface ReactiveGraph {
  upsertNode<T = unknown>(node: DagifyNode<T>): DagifyNode<T>;
  addNode(node: DagifyNode<any>): void;
  addNodes(nodes: DagifyNode<any>[]): void;
  removeNode(node: NodeReference): void;
  connect(
    src: NodeReference | NodeReference[],
    tgt: NodeReference | NodeReference[]
  ): void;
  disconnect(
    src: NodeReference | NodeReference[],
    tgt: NodeReference | NodeReference[]
  ): void;
  createsCycle(src: Uint8Array | NodeReference, tgt: Uint8Array | NodeReference): boolean;
  update(): void;
  updateAsync(): Promise<void>;
  getNode(
    ref: NodeReference | NodeReference[]
  ): DagifyNode<any> | DagifyNode<any>[];
  getNodes(): DagifyNode<any>[];
  getEdges(): GraphEdge[];
  findNode(predicate: (node: DagifyNode<any>) => boolean): DagifyNode<any> | null;
  getImmediatePredecessors(ref: NodeReference): DagifyNode<any>[];
  getPredecessors(
    ref: NodeReference,
    options?: GraphTraversalOptions
  ): DagifyNode<any>[];
  getImmediateSuccessors(ref: NodeReference): DagifyNode<any>[];
  getSuccessors(
    ref: NodeReference,
    options?: GraphTraversalOptions
  ): DagifyNode<any>[];
  getSources(): DagifyNode<any>[];
  getSinks(): DagifyNode<any>[];
  topologicalSort(): Uint8Array[];
  toString(): string;
  findPath(src: NodeReference, tgt: NodeReference): Uint8Array[] | null;
  getInDegree(ref: NodeReference): number;
  hasNode(ref: NodeReference): boolean;
  getOutDegree(ref: NodeReference): number;
  hasEdge(src: NodeReference, tgt: NodeReference): boolean;
  clear(): void;
  getConnectedComponent(ref: NodeReference): DagifyNode<any>[];
}

export declare function createGraph(
  config?: Record<string, unknown>
): ReactiveGraph;
