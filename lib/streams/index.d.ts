import type { Readable } from "stream";
import type {
  DagifyNode,
  FromAsyncIterableOptions,
  ToAsyncIterableOptions,
  ToReadableStreamOptions,
} from "../../types/shared";

export function fromAsyncIterable<T = unknown>(
  iterable: AsyncIterable<T>,
  options?: FromAsyncIterableOptions<T>
): DagifyNode<T>;

export function fromReadableStream<T = unknown>(
  readable: AsyncIterable<T>,
  options?: FromAsyncIterableOptions<T>
): DagifyNode<T>;

export function toAsyncIterable<T = unknown>(
  source: DagifyNode<T> | Observable<T>,
  options?: ToAsyncIterableOptions<T>
): AsyncIterable<T>;

export function toReadableStream<T = unknown>(
  source: DagifyNode<T> | Observable<T>,
  options?: ToReadableStreamOptions<T>
): Promise<Readable>;
