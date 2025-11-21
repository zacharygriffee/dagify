import type { DagifyNode } from "../../types/shared";

export type { DagifyNode } from "../../types/shared";

export declare function createEventNode<T = unknown>(
  eventName: string,
  defaultValue?: T,
  context?: string
): DagifyNode<T>;
