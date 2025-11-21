export interface Dispatcher {
  on<T = unknown>(
    eventName: string,
    handler: (payload: T) => void,
    context?: string
  ): () => void;
  off<T = unknown>(
    eventName: string,
    handler: (payload: T) => void,
    context?: string
  ): void;
  emit<T = unknown>(
    eventName: string,
    payload: T,
    context?: string
  ): void;
}

export declare const dispatcher: Dispatcher;
