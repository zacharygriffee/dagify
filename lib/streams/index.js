import { from as rxFrom } from "rxjs";
import { fromObservable, setFromObservableNodeCtor } from "../util/fromObservable.js";
import { NO_EMIT } from "../node/NO_EMIT.js";
import { isRxObservable } from "../rxjs/isRxObservable.js";
import { ReactiveNode } from "../node/ReactiveNode.js";

const isAsyncIterable = (input) => input && typeof input[Symbol.asyncIterator] === "function";
const isDagifyNode = (input) => input?.isDagifyNode === true;

// Ensure fromObservable knows how to construct Dagify nodes even if consumers
// import this module before anything else.
setFromObservableNodeCtor(ReactiveNode);

const normalizeFromOptions = (options = {}) => ({
    initialValue: options.initialValue ?? NO_EMIT,
    nodeConfig: options.nodeConfig ?? options.config ?? {}
});

/**
 * Convert an async iterable into a Dagify node.
 *
 * @param {AsyncIterable} iterable
 * @param {object} [options]
 * @param {*} [options.initialValue]
 * @param {object} [options.nodeConfig]
 */
const fromAsyncIterable = (iterable, options) => {
    if (!isAsyncIterable(iterable)) {
        throw new TypeError("fromAsyncIterable expects an AsyncIterable.");
    }
    const { initialValue, nodeConfig } = normalizeFromOptions(options);
    const obs = rxFrom(iterable);
    return fromObservable(obs, initialValue, nodeConfig);
};

/**
 * Convert a Node/streamx Readable (or any async-iterable stream) into a Dagify node.
 *
 * @param {object} readable
 * @param {object} [options]
 */
const fromReadableStream = (readable, options) => {
    if (!isAsyncIterable(readable)) {
        throw new TypeError("fromReadableStream expects a stream that implements Symbol.asyncIterator.");
    }
    return fromAsyncIterable(readable, options);
};

const toObservable = (source) => {
    if (isDagifyNode(source)) return source.stream;
    if (isRxObservable(source)) return source;
    throw new TypeError("Expected a Dagify node or RxJS observable.");
};

const defaultOverflow = "error";

/**
 * Convert a Dagify node or RxJS observable into an async iterable.
 *
 * Supports bounded buffering with an overflow strategy.
 *
 * @param {DagifyNode|Observable} source
 * @param {object} [options]
 * @param {number} [options.maxBuffer=Infinity]
 * @param {"drop-newest"|"drop-oldest"|"error"|((info:{bufferLength:number,value:any})=>any)} [options.onOverflow]
 * @param {AbortSignal} [options.signal]
 */
const toAsyncIterable = (source, options = {}) => {
    const { maxBuffer = Infinity, onOverflow, signal, dropNoEmit = true } = options;
    const obs = toObservable(source);

    return {
        [Symbol.asyncIterator]() {
            const buffer = [];
            let done = false;
            let error = null;
            let notify;

            const overflow = (value) => {
                const strategy = typeof onOverflow === "function"
                    ? onOverflow({ bufferLength: buffer.length, value })
                    : onOverflow || defaultOverflow;
                if (strategy === "drop-oldest" && buffer.length) {
                    buffer.shift();
                    buffer.push(value);
                    return;
                }
                if (strategy === "drop-newest") {
                    return;
                }
                error = new Error("Async iterable buffer overflow");
                done = true;
                subscription?.unsubscribe();
                notify?.();
            };

            let subscription;
            subscription = obs.subscribe({
                next(value) {
                    if (done) return;
                    if (dropNoEmit && value === NO_EMIT) {
                        return;
                    }
                    if (buffer.length >= maxBuffer) {
                        overflow(value);
                        return;
                    }
                    buffer.push(value);
                    notify?.();
                },
                error(err) {
                    error = err || new Error("Unknown observable error");
                    done = true;
                    notify?.();
                },
                complete() {
                    done = true;
                    notify?.();
                }
            });

            if (signal) {
                if (signal.aborted) {
                    done = true;
                    subscription.unsubscribe();
                } else {
                    signal.addEventListener("abort", () => {
                        done = true;
                        subscription.unsubscribe();
                        notify?.();
                    });
                }
            }

            return {
                async next() {
                    if (buffer.length) {
                        return { value: buffer.shift(), done: false };
                    }
                    if (error) {
                        const err = error;
                        error = null;
                        throw err;
                    }
                    if (done) return { value: undefined, done: true };
                    return new Promise((resolve, reject) => {
                        notify = () => {
                            notify = null;
                            if (buffer.length) {
                                resolve({ value: buffer.shift(), done: false });
                                return;
                            }
                            if (error) {
                                const err = error;
                                error = null;
                                reject(err);
                                return;
                            }
                            resolve({ value: undefined, done: true });
                        };
                    });
                },
                return() {
                    done = true;
                    subscription.unsubscribe();
                    notify?.();
                    return { done: true };
                },
                throw(err) {
                    done = true;
                    subscription.unsubscribe();
                    notify?.();
                    return Promise.reject(err);
                }
            };
        }
    };
};

/**
 * Convert a Dagify node or RxJS observable into a Node Readable stream.
 * Lazy-loads the Node stream module to avoid pulling it into browser bundles.
 *
 * @param {DagifyNode|Observable} source
 * @param {object} [options]
 * @param {number} [options.maxBuffer]
 * @param {AbortSignal} [options.signal]
 * @param {number} [options.highWaterMark]
 * @param {boolean} [options.objectMode=true]
 * @returns {Promise<import('stream').Readable>}
 */
const toReadableStream = async (source, options = {}) => {
    const { Readable } = await import("stream");
    const iterable = toAsyncIterable(source, options);
    const { highWaterMark, objectMode = true } = options;
    return Readable.from(iterable, { highWaterMark, objectMode });
};

/**
 * Recursively resolves async-ish inputs (observables, promises, thunks)
 * down to a single plain value, returned as a one-shot observable.
 *
 * - Observables are subscribed to for their first emission, then recursed.
 * - Promises/thenables are awaited then recursed.
 * - Functions are invoked (if zero-arity) and their result is recursed.
 *
 * @param {*} input
 * @returns {import("rxjs").Observable<*>}
 */
const floorAsync = (input) => defer(() => {
    const value = typeof input === "function" && input.length === 0 ? input() : input;

    const obs = isDagifyNode(value)
        ? value.stream.pipe(rxFilter(v => v !== NO_EMIT))
        : (isRxObservable(value) ? value : null) || (isRxJsObservable(value) ? value : null);
    if (obs) {
        return obs.pipe(
            take(1),
            switchMap(v => floorAsync(v))
        );
    }

    if (isThenable(value)) {
        return rxFrom(value).pipe(
            take(1),
            switchMap(v => floorAsync(v))
        );
    }

    return of(value);
});

export {
    fromAsyncIterable,
    fromReadableStream,
    toAsyncIterable,
    toReadableStream
};
