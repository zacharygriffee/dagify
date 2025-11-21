import type { Observable, Subject } from "rxjs";
import type { DagifyNode, NodeConfig } from "../../types/shared";

export type { DagifyNode, NodeConfig } from "../../types/shared";

export declare function createTrigger<T = unknown>(): Subject<T>;

export declare function trigger<T = number>(
  sources:
    | Observable<unknown>
    | Observable<unknown>[]
    | Record<string, Observable<unknown>>,
  config?: NodeConfig<T>
): DagifyNode<T>;

export declare function triggerFromEvent(
  source: EventTarget | NodeJS.EventEmitter,
  eventName: string,
  config?: NodeConfig<number>
): DagifyNode<number>;
