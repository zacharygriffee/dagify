import type { Observable, Observer, Subject, Subscription } from "rxjs";

export type DagifyTypeChecker = string | ((value: unknown) => boolean);

export interface NodeMetadata {
  [key: string]: unknown;
  type?: DagifyTypeChecker;
  valueEncoding?: string;
}

export interface NodeConfig<T = unknown> {
  disableBatching?: boolean;
  key?: Uint8Array;
  finalize?: () => void;
  onCleanup?: () => void;
  onSubscribe?: (subscriberCount: number) => void;
  onUnsubscribe?: (subscriberCount: number) => void;
  metadata?: NodeMetadata;
  type?: DagifyTypeChecker;
  valueEncoding?: string;
  enableActivityThresholding?: boolean;
  activationThreshold?: number;
  decayInterval?: number;
  sink?: boolean;
  skip?: number;
  shallow?: boolean;
  terminal?: boolean;
  errorRetentionTime?: number;
  maxQueueLength?: number;
  overflowStrategy?: QueueOverflowStrategy;
  onOverflow?: (info: QueueOverflowInfo) => QueueOverflowDecision | void;
  failFast?: boolean;
  failFastPredicate?: (error: unknown) => boolean;
}

export type DependencySource<T = unknown> =
  | DagifyNode<T>
  | Observable<T>
  | Promise<T>
  | ((...args: any[]) => T)
  | T;

export type DependencyCollection<T = unknown> =
  | DependencySource<T>
  | DependencySource<T>[]
  | { [key: string]: DependencySource<T> };

export type NodeReference<T = unknown> = string | Uint8Array | DagifyNode<T>;

export interface GraphEdge {
  src: DagifyNode<any>;
  tgt: DagifyNode<any>;
}

export interface GraphTraversalOptions {
  transitive?: boolean;
}

export interface DagifyNode<T = unknown> extends Subject<T> {
  readonly isDagifyNode: true;
  readonly isSink: boolean;
  readonly isAsync: boolean;
  readonly isComputed: boolean;
  readonly isActive: boolean;
  readonly unbatched: boolean;
  readonly dependencyError$: Observable<unknown>;
  readonly stream: Observable<T>;
  readonly once: Observable<T>;
  readonly skip: Observable<T>;
  readonly id: string;
  key: Uint8Array;
  value: T;
  metadata: NodeMetadata;
  type: DagifyTypeChecker;
  valueEncoding: string;
  normalizedDeps: DependencyCollection<any>;
  visit(): void;
  compute(force?: boolean): void;
  update(value?: T | ((prev: T) => T)): void;
  set(value: T): void | Promise<void>;
  toObservable(): Observable<T>;
  listDependencies(): string[];
  addDependency(...dependencies: DependencySource<any>[]): void;
  removeDependency(...dependencies: DependencySource<any>[]): void;
  updateDependencies(
    updater: (deps: DependencyCollection<any>) => DependencyCollection<any>
  ): void;
  encodeForSink(): Uint8Array;
  getId(): string;
  complete(): void;
  error(error: unknown): void;
}

export type QueueOverflowStrategy = "drop-newest" | "drop-oldest" | "error";
export type QueueOverflowDecision = QueueOverflowStrategy | "enqueue";
export interface QueueOverflowInfo {
  strategy: QueueOverflowStrategy;
  queueLength: number;
  incoming: unknown;
}

export interface ShallowReactiveNode<T = unknown> extends DagifyNode<T> {}

export interface CompositeConfig extends NodeConfig {
  disableBatching?: boolean;
}

export interface CompositeNode<
  T = unknown,
  TShape extends DagifyNode<any>[] | Record<string, DagifyNode<any>> = any
> extends DagifyNode<T> {
  readonly nodes: TShape;
  readonly config: CompositeConfig;
  set(value: any): void;
  update(): void;
}

export interface TriggerNode<T = unknown> extends DagifyNode<T> {}

export interface ExecutionNode<T = unknown> extends DagifyNode<T> {
  readonly executionStream: Observable<unknown>;
  triggerExecution(): void;
  dispose(): void;
}

export interface CommandNode<TInput = unknown, TResult = unknown>
  extends DagifyNode<TResult> {
  readonly commandName: string;
  readonly handler: (payload: TInput) => TResult | Promise<TResult>;
  readonly validator?:
    | ((payload: TInput) => { valid: boolean; error?: Error })
    | undefined;
  readonly filter?: ((payload: TInput) => boolean | Promise<boolean>) | undefined;
  readonly map?: ((payload: TInput) => TInput) | undefined;
  set(payload: TInput | TResult): Promise<void> | void;
  next(payload: TInput | TResult): void;
}

export interface CommandNodeOptions<TInput = unknown, TResult = unknown>
  extends NodeConfig<TResult> {
  validator?: (payload: TInput) => { valid: boolean; error?: Error };
  filter?: (payload: TInput) => boolean | Promise<boolean>;
  map?: (payload: TInput) => TInput;
}

export interface BridgeNode<T = unknown> extends DagifyNode<T> {
  readonly inputNode: DagifyNode<any>;
  readonly outputNode: DagifyNode<T>;
  set(value: any): Promise<void> | void;
}

export interface EventNode<T = unknown> extends DagifyNode<T> {}

export interface FilterNode<T = unknown> extends DagifyNode<T> {}

export interface SinkNode<T = unknown> extends DagifyNode<T> {
  encodeForSink(): Uint8Array;
}

export interface EffectHandle<T = unknown> {
  dispose(): void;
  node: DagifyNode<T>;
}

export interface DagifyNodeFactory<TNode extends DagifyNode<any> = DagifyNode<any>>
  extends Iterable<TNode> {
  clear(): void;
  get(id: string | number): TNode;
}
