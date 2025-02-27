import { Observable, ReplaySubject, skip, Subject, take } from 'rxjs';
import { isRxObservable } from "../rxjs/isRxObservable.js";
import { deepEqual } from "../util/deepEqual.js";
import { normalizeDependency } from "./normalizeDependency.js";
import { collectReactiveNodes } from "./collectReactiveNodes.js";
import { getDependencyValue } from "./getDependencyValue.js";
import * as z32 from "../util/z32.js";
import { isPlainObject } from "../util/IsPlainObject.js";
import { NO_EMIT } from "./NO_EMIT.js";
import { currentKeyGenerator } from "./key-management/index.js";
import { diffOperator } from "../operators/index.js";

/**
 * Represents a reactive node in a directed acyclic graph (DAG).
 * Supports computed values, subscriptions, error handling, and completion.
 *
 * @class ReactiveNode
 * @extends {Subject}
 *
 * @property {boolean} disableBatching - If true, the node bypasses batching and updates immediately.
 * @property {boolean} unbatched - Indicates if batching is disabled for this node.
 */
class ReactiveNode extends Subject {
    static pendingUpdates = new Set();
    static updating = false;
    static batchMode = false;

    /**
     * Creates a new ReactiveNode instance.
     *
     * - If `fnOrValue` is a function, creates a computed node.
     * - Otherwise, creates a static node with an initial value.
     *
     * @param {Function|*} fnOrValue - A function for computed nodes or a static value.
     * @param {(ReactiveNode | Composite | Function | Promise | Observable) |
     *         (ReactiveNode | Composite | Function | Promise | Observable)[] |
     *         { [key: string]: ReactiveNode | Composite | Function | Promise | Observable }} [dependencies=[]] - The dependencies for computed nodes.
     * @param {Object} [config] - (Optional) Configuration options.
     * @param {boolean} [config.disableBatching=false] - If true, bypasses batching for updates.
     * @param {Buffer} [config.key] - A 32-byte buffer used as the node's key.
     * @param {function} [config.finalize] - A callback invoked when the node is finalized (on complete or error).
     * @param {function} [config.onCleanup] - (Deprecated) Same as finalize.
     * @param {function} [config.onSubscribe] - A callback invoked on every new subscription (receives the new subscriber count).
     * @param {function} [config.onUnsubscribe] - A callback invoked on every unsubscription (receives the new subscriber count).
     */
    constructor(fnOrValue, dependencies, config) {
        super();
        const isComputed = typeof fnOrValue === "function";

        if (!isComputed && typeof dependencies === "object" && !config) {
            Object.assign(config ||= {}, dependencies);
            dependencies = undefined;
        } else if ((isComputed && !config) || (!isComputed && !dependencies && !config)) {
            config = {};
        }

        if (config.key && config.key.byteLength !== 32) {
            throw new Error("Key must be 32 byte buffer.");
        }

        this.disableBatching = config.disableBatching || false;
        // New finalize option; if not provided, fallback to onCleanup (deprecated)
        this.finalize = config.finalize || config.onCleanup || (() => {});
        // Keep onCleanup for backwards compatibility
        this.onCleanup = config.onCleanup || (() => {});
        this.onSubscribe = config.onSubscribe || (() => {});
        this.onUnsubscribe = config.onUnsubscribe || (() => {});

        this._dependencyErrorSubject = new ReplaySubject(undefined, config.errorRetentionTime || 5000);
        this._skip = config.skip || 0;
        this._isSink = config.sink || false;

        this._encodedId = null;
        this.subscribers = new Set();
        this._completed = false;

        if (isComputed) {
            this.fn = fnOrValue;
            this.value = NO_EMIT;
            this.normalizedDeps = dependencies !== undefined ? normalizeDependency(dependencies) : [];
            const reactiveNodes = collectReactiveNodes(this.normalizedDeps);
            this._dependencySubscriptions = reactiveNodes.map(dep =>
                dep.subscribe(() => ReactiveNode.scheduleUpdate(this))
            );
            this.compute();
        } else {
            this.fn = null;
            if (isRxObservable(fnOrValue)) {
                this._isAsync = true;
                this._subscribeToObservable(fnOrValue);
            } else {
                this._isAsync = false;
                this.value = fnOrValue === undefined ? NO_EMIT : fnOrValue;
            }
        }

        this._key = config.key || currentKeyGenerator(this);
    }

    /**
     * Returns an Observable that emits errors from dependencies.
     *
     * This observable provides a dedicated channel for dependency errors, allowing subscribers
     * to be notified of errors occurring in any dependency without interfering with the node’s
     * main data stream. Errors emitted on this channel are typically produced during the computation
     * phase when one or more dependencies encounter an error.
     *
     * @returns {Observable<Error>} An observable that emits error objects from dependencies.
     */
    get dependencyError$() {
        return this._dependencyErrorSubject.asObservable();
    }

    /**
     * Indicates that this is a Dagify node.
     * @type {boolean}
     */
    get isDagifyNode() {
        return true;
    }

    get isSink() {
        return this._isSink;
    }

    /**
     * Indicates whether batching is disabled for this node.
     * @returns {boolean}
     */
    get unbatched() {
        return this.disableBatching;
    }

    /**
     * Indicates whether the node is performing asynchronous computation.
     * @type {boolean}
     */
    get isAsync() {
        return !!this._isAsync;
    }

    /**
     * Indicates whether this node is computed.
     * @type {boolean}
     */
    get isComputed() {
        return !!this.fn;
    }

    get isActive() {
        return this.value !== NO_EMIT;
    }

    /**
     * Returns the unique identifier for this node.
     * @type {string}
     */
    get id() {
        if (!this._encodedId) {
            this._encodedId = z32.encode(this.key);
        }
        return this._encodedId;
    }

    /**
     * Returns the public key (Buffer) of this node.
     * @type {Buffer}
     */
    get key() {
        return this._key;
    }

    /**
     * Sets the node's key. The key must be a 32-byte Buffer.
     * @param {Buffer} value - The new key.
     * @throws {Error} If the key is not 32 bytes.
     */
    set key(value) {
        if (value.byteLength !== 32) throw new Error("Key must be 32 byte buffer.");
        this._key = value;
    }

    /**
     * Returns an Observable that skips the initial emission.
     * @returns {Observable} An observable skipping the first value.
     */
    get skip() {
        return this.pipe(skip(1));
    }

    /**
     * Returns an Observable that emits only once.
     * @returns {Observable} An observable that emits the node's next value once.
     */
    get once() {
        return this.toObservable().pipe(take(1));
    }

    /**
     * Returns an observable that emits diff objects based on successive array emissions.
     *
     * If the node's value type is not "array", an error is thrown.
     *
     * The diff objects indicate the changes between consecutive array emissions:
     * - Items added are emitted as: { type: 'new', values: [...] }
     * - Items removed are emitted as: { type: 'del', values: [...] }
     *
     * This getter applies the `diffOperator` to the current observable stream.
     *
     * @throws {Error} Throws an error if the composite node is not in array mode.
     *
     * @returns {import('rxjs').OperatorFunction<T[], { new?: T[], del?: T[], same?: T[] }>}
     *   An observable emitting arrays of diff objects.
     */
    get diff() {
        return this.pipe(diffOperator());
    }

    /**
     * Schedules an update for the given node.
     * If `disableBatching` is true, the update is processed immediately.
     *
     * @param {ReactiveNode} node - The node to update.
     */
    static scheduleUpdate(node) {
        if (node.disableBatching) {
            node.compute();
            return;
        }
        if (ReactiveNode.batchMode) {
            ReactiveNode.pendingUpdates.add(node);
            return;
        }
        ReactiveNode.pendingUpdates.add(node);
        if (!ReactiveNode.updating) {
            ReactiveNode.updating = true;
            queueMicrotask(() => {
                ReactiveNode.pendingUpdates.forEach(n => n.compute());
                ReactiveNode.pendingUpdates.clear();
                ReactiveNode.updating = false;
            });
        }
    }

    /**
     * Executes a function in batch mode so that subscribers receive only the final update.
     * @param {Function} fn - The function containing multiple updates.
     */
    static batch(fn) {
        ReactiveNode.batchMode = true;
        fn();
        ReactiveNode.batchMode = false;
        ReactiveNode.pendingUpdates.forEach(n => n.compute());
        ReactiveNode.pendingUpdates.clear();
    }

    /**
     * Retrieves or generates the unique identifier for this node.
     * If the node has its own generator, it will be used.
     * Otherwise, falls back to the global idGenerator.
     *
     * @returns {string} The node's unique identifier.
     */
    getId() {
        return z32.encode(this.key);
    }

    /**
     * Filters dependency values, removing any that are errors.
     * Emits any error encountered on _dependencyErrorSubject.
     *
     * @param {*} depValue - The dependency value(s) returned by getDependencyValue.
     * @param {*} normalizedDeps - The current normalized dependencies.
     * @param {Subject} errorSubject - The subject used to emit dependency errors.
     * @returns {Object} An object containing:
     *  - valid: Boolean indicating if no dependency error was found.
     *  - values: The filtered (and unwrapped, if needed) dependency values.
     *  - normalized: The filtered normalized dependencies.
     */
    filterDependencyErrors(depValue, normalizedDeps, errorSubject) {
        let errorFound = false;
        let values, newNormalized;

        // If the dependency is a Dagify node, do not unwrap it.
        if (depValue && depValue.isDagifyNode) {
            // Check if the node itself is in error.
            if (depValue._error instanceof Error) {
                errorSubject.next(depValue._error);
                return { valid: false };
            }
            return { valid: true, values: depValue, normalized: normalizedDeps };
        }

        // If the dependency is a direct error.
        if (depValue instanceof Error) {
            errorSubject.next(depValue);
            return { valid: false };
        }

        // For array dependencies, iterate over each element.
        if (Array.isArray(depValue)) {
            values = [];
            newNormalized = [];
            for (let i = 0; i < depValue.length; i++) {
                let value = depValue[i];
                // If the value is a Dagify node, do not unwrap it.
                if (value && value.isDagifyNode) {
                    // Check its error state.
                    if (value._error instanceof Error) {
                        errorSubject.next(value._error);
                        errorFound = true;
                        continue;
                    }
                } else if (value instanceof Error) {
                    errorSubject.next(value);
                    errorFound = true;
                    continue;
                }
                values.push(value);
                newNormalized.push(normalizedDeps[i]);
            }
            return { valid: !errorFound, values, normalized: newNormalized };
        }

        // For plain objects (named dependencies) only.
        if (isPlainObject(depValue)) {
            values = {};
            newNormalized = {};
            for (const key in depValue) {
                let value = depValue[key];
                if (value && value.isDagifyNode) {
                    if (value._error instanceof Error) {
                        errorSubject.next(value._error);
                        errorFound = true;
                        continue;
                    }
                } else if (value instanceof Error) {
                    errorSubject.next(value);
                    errorFound = true;
                    continue;
                }
                values[key] = value;
                newNormalized[key] = normalizedDeps[key];
            }
            return { valid: !errorFound, values, normalized: newNormalized };
        }

        // For any other non-iterable value, just return it as-is.
        return { valid: true, values: depValue, normalized: normalizedDeps };
    }

    /**
     * Computes the node's value.
     *
     * For positional dependencies:
     *  - If the computed function declares exactly one parameter, the dependency array is passed as-is.
     *  - Otherwise, the dependency array is spread into individual arguments.
     *
     * For named dependencies, the dependency is always passed as a single argument.
     * If any dependency has the value `NO_EMIT`, computation is skipped.
     */
    compute() {
        if (!this.fn) return;
        try {
            // Get the dependency values.
            const depValue = getDependencyValue(this.normalizedDeps);

            // Check if any dependency equals NO_EMIT.
            // For array dependencies:
            if (Array.isArray(depValue) && depValue.some(val => val === NO_EMIT)) {
                return; // Skip computation if any dependency is NO_EMIT.
            }
            // For plain object dependencies:
            if (isPlainObject(depValue)) {
                for (const key in depValue) {
                    if (depValue[key] === NO_EMIT) return; // Skip computation.
                }
            }
            // If a single dependency is NO_EMIT:
            if (!Array.isArray(depValue) && !isPlainObject(depValue) && depValue === NO_EMIT) {
                return;
            }

            // Filter dependency errors (while preserving Dagify nodes as-is).
            const filtered = this.filterDependencyErrors(depValue, this.normalizedDeps, this._dependencyErrorSubject);
            if (!filtered.valid) {
                this.normalizedDeps = filtered.normalized;
                return; // Abort computation if any dependency is in error.
            }

            // Proceed with computation using filtered.values.
            let result;
            if (Array.isArray(this.normalizedDeps) && this.fn.length !== 1) {
                result = this.fn(...filtered.values);
            } else {
                result = this.fn(filtered.values);
            }

            this._isAsync = false;
            if (result && typeof result.subscribe === 'function') {
                this._isAsync = true;
                if (this._asyncSubscription) {
                    this._asyncSubscription.unsubscribe();
                }
                this._asyncSubscription = result.subscribe(
                    newValue => this._setValue(newValue),
                    err => {
                        this._dependencyErrorSubject.next(err);
                        this.error(err);
                    }
                );
            } else if (result && typeof result.then === 'function') {
                this._isAsync = true;
                Promise.resolve(result)
                    .then(newValue => this._setValue(newValue))
                    .catch(err => {
                        this._dependencyErrorSubject.next(err);
                        this.error(err);
                    });
            } else {
                if (!deepEqual(this._lastComputed, result)) {
                    this._lastComputed = result;
                    this._setValue(result);
                }
            }
            // Clear previous error if computation succeeds.
            this._error = undefined;
        } catch (err) {
            console.warn(err);
            this.value = err;
            this._dependencyErrorSubject.next(err);
            this._error = err;
            this._notifyAll('error', err);
        }
    }

    /**
     * Sets a new value for a static node.
     * If the node is computed, an error is thrown.
     * Returns a promise that resolves on the next tick.
     * Awaiting this promise is optional.
     *
     * @param {*} newValue - The new value to set.
     * @returns {Promise<void>|void} A promise that resolves after the value update is processed. If disableBatching it does not return a promise.
     * @throws {Error} If called on a computed node.
     */
    set(newValue) {
        if (this.fn) throw new Error("Cannot manually set a computed node");

        if (isRxObservable(newValue)) {
            this._subscribeToObservable(newValue);
        } else {
            if (this._observableSubscription) {
                this._observableSubscription.unsubscribe();
                this._observableSubscription = null;
            }
            this._setValue(newValue);
        }

        if (!this.disableBatching) return new Promise(resolve => setTimeout(resolve, 0));
    }

    /**
     * For static nodes, behaves like set(). For computed nodes, triggers recomputation.
     *
     * @param {*} value - New value or a function to update the node.
     */
    next(value) {
        this.fn ? this.compute() : this.set(value);
    }

    /**
     * Subscribes to value changes on the node.
     *
     * @param {Function|Object} observer - A function or an observer object.
     * @returns {Function} A function to unsubscribe.
     */
    subscribe(observer) {
        return this._subscribeCore(observer);
    }

    /**
     * Subscribes to the node and automatically unsubscribes after one emission.
     *
     * @param {Function|Object} observer - A function or observer object.
     * @returns {Function} A function to unsubscribe.
     */
    subscribeOnce(observer) {
        return this.toObservable().pipe(take(1)).subscribe(observer);
    }

    /**
     * Notifies subscribers of an error.
     *
     * @param {Error} err - The error to notify.
     */
    error(err) {
        // Call finalize before propagating error
        this.finalize(err);
        this._notifyAll('error', err);
    }

    /**
     * Completes the node, notifying subscribers and cleaning up resources.
     */
    complete() {
        this._completed = true;
        this._notifyAll('complete');
        this.subscribers.clear();
        this._unsubscribeDependencies();
        // Call finalize without error
        this.finalize();
        if (this._observableSubscription) {
            this._observableSubscription.unsubscribe();
            this._observableSubscription = null;
        }
    }

    /**
     * Internal method to update the node's value and notify subscribers.
     *
     * If newValue is the NO_EMIT symbol, the value is not updated or emitted.
     *
     * @param {*} newValue - The new value to set.
     * @param {boolean} [forceEmit=false] - Whether to force an emission even if the value is unchanged.
     */
    _setValue(newValue, forceEmit = false) {
        if (newValue === NO_EMIT) return;
        const prevValue = this.value;
        this.value = newValue;
        if (forceEmit || !deepEqual(prevValue, newValue)) {
            this._notifyAll('next', newValue);
        }
    }

    /**
     * Core subscription logic handling observer initialization, initial emission, and dependency subscriptions.
     *
     * @param {Function|Object} observer - The observer to subscribe.
     * @returns {Function} Unsubscribe function.
     * @private
     */
    _subscribeCore(observer) {
        if (this.isSink) {
            throw new Error("Sink nodes are terminal and cannot be subscribed to as dependencies.");
        }

        if (this._completed) {
            if (typeof observer.complete === 'function') observer.complete();
            return () => {};
        }

        const subscriber = this._initializeObserver(observer);
        this.subscribers.add(subscriber);
        // Invoke onSubscribe callback with the updated subscriber count.
        this.onSubscribe(this.subscribers.size);

        if (typeof subscriber.next === 'function') {
            if (this._error !== undefined) {
                if (typeof subscriber.error === 'function') subscriber.error(this._error);
                subscriber.closed = true;
            } else {
                if (this._skip > 0 || this.value === NO_EMIT) {
                    this._skip--;
                } else {
                    subscriber.next(this.value);
                    subscriber.lastEmitted = this.value;
                }
            }
        }

        if (this.fn && (!this._dependencySubscriptions || !this._dependencySubscriptions.length)) {
            const reactiveNodes = collectReactiveNodes(this.normalizedDeps);
            this._dependencySubscriptions = reactiveNodes.map(dep =>
                dep.subscribe(() => ReactiveNode.scheduleUpdate(this))
            );
            ReactiveNode.scheduleUpdate(this);
        }

        const unsubscribe = () => {
            subscriber.closed = true;
            this.subscribers.delete(subscriber);
            // Call onUnsubscribe callback with new subscriber count.
            this.onUnsubscribe(this.subscribers.size);
            if (this.subscribers.size === 0) {
                this._unsubscribeDependencies();
            }
        };
        unsubscribe.unsubscribe = unsubscribe;
        return unsubscribe;
    }

    /**
     * Initializes an observer object from a callback or observer.
     *
     * @param {Function|Object} observer - The observer or callback.
     * @returns {Object} A standardized observer object.
     * @private
     */
    _initializeObserver(observer) {
        if (observer && typeof observer._next === 'function') return observer;
        if (!observer) observer = {};
        if (typeof observer === 'function') observer = { next: observer };
        return {
            next: observer.next || (() => {}),
            error: observer.error || (() => {}),
            complete: observer.complete || (() => {}),
            closed: false,
            lastEmitted: undefined,
            errorNotified: false
        };
    }

    /**
     * Notifies all subscribers of a given event (next, error, complete) asynchronously.
     *
     * @param {string} type - The type of event ('next', 'error', 'complete').
     * @param {*} [value] - The value associated with the event.
     * @private
     */
    _notifyAll(type, value) {
        // If no batching, do synchronous calls
        if (this.disableBatching) {
            this.subscribers.forEach(subscriber => {
                if (subscriber.closed) return;
                if (type === 'error' && !subscriber.errorNotified && typeof subscriber.error === 'function') {
                    subscriber.error(value);
                    subscriber.errorNotified = true;
                    subscriber.closed = true;
                } else if (type === 'next' && typeof subscriber.next === 'function') {
                    subscriber.next(value);
                } else if (type === 'complete' && typeof subscriber.complete === 'function') {
                    subscriber.complete();
                    subscriber.closed = true;
                }
            });
        } else {
            this.subscribers.forEach(subscriber => {
                if (subscriber.closed) return;
                queueMicrotask(() => {
                    if (type === 'error' && !subscriber.errorNotified && typeof subscriber.error === 'function') {
                        subscriber.error(value);
                        subscriber.errorNotified = true;
                        subscriber.closed = true;
                    } else if (type === 'next' && typeof subscriber.next === 'function') {
                        subscriber.next(value);
                    } else if (type === 'complete' && typeof subscriber.complete === 'function') {
                        subscriber.complete();
                        subscriber.closed = true;
                    }
                });
            });
        }
    }

    /**
     * Unsubscribes from all dependency subscriptions.
     * @private
     */
    _unsubscribeDependencies() {
        this._dependencySubscriptions?.forEach(unsubscribe => unsubscribe());
        this._dependencySubscriptions = [];
    }

    /**
     * Sets or updates the dependencies for this computed ReactiveNode.
     *
     * This method establishes the dependencies that the computed node relies on. It performs the following steps:
     *
     * 1. **Validation:** Throws an error if the node is not computed (i.e., it does not have a computation function).
     * 2. **Normalization:** Converts the provided dependencies into a normalized format using `normalizeDependency`.
     *    If no dependencies are provided, it clears any existing dependencies.
     * 3. **Subscription:** Extracts the underlying reactive nodes via `collectReactiveNodes` and subscribes to each.
     *    Each subscription will schedule an update to the computed node when the dependency changes.
     * 4. **Recomputation:** Immediately triggers a recomputation of the node's value by calling `compute()`.
     *
     * @param {Array|any} [dependencies] - The dependency or array of dependencies to set. If omitted or undefined,
     *                                     the node's dependencies will be cleared.
     * @throws {Error} Throws an error if the node is not a computed node (i.e., no computation function exists).
     *
     * @example
     * // For a computed ReactiveNode, update its dependencies:
     * computedNode.setDependencies([dependency1, dependency2]);
     *
     * @example
     * // To clear all dependencies of a computed node:
     * computedNode.setDependencies();
     */
    setDependencies(dependencies) {
        if (!this.fn) throw new Error("Cannot set dependency to a non-computed node.");
        this.normalizedDeps = dependencies !== undefined ? normalizeDependency(dependencies) : [];
        const reactiveNodes = collectReactiveNodes(this.normalizedDeps);
        this._dependencySubscriptions = reactiveNodes.map(dep =>
            dep.subscribe(() => ReactiveNode.scheduleUpdate(this))
        );
        this.compute();
    }

    /**
     * Adds one or more dependencies to a computed node.
     *
     * Behavior:
     * - **Positional (array) mode:** If the node was created with an array dependency,
     *   the new dependency(ies) are appended.
     * - **Named (object) mode:** If created with an object dependency, keys are added or merged.
     *
     * @param {...*} args - The dependency(ies) to add.
     * @throws {Error} If called on a non-computed node.
     */
    addDependency(...args) {
        if (!this.fn) throw new Error("Cannot add dependency to a non-computed node.");
        args.forEach(dep => {
            if (dep && dep.isSink) throw new Error("Sink nodes cannot be used as dependencies.");
        });
        if (Array.isArray(this.normalizedDeps)) {
            let depsToAdd = [];
            if (args.length === 1) {
                const arg = args[0];
                depsToAdd = Array.isArray(arg) ? arg : [arg];
            } else {
                depsToAdd = args;
            }
            depsToAdd.forEach(dep => {
                const normalized = normalizeDependency(dep);
                this.normalizedDeps.push(normalized);
                const reactiveNodes = collectReactiveNodes(normalized);
                reactiveNodes.forEach(node => {
                    const unsubscribe = node.subscribe(() => ReactiveNode.scheduleUpdate(this));
                    this._dependencySubscriptions.push(unsubscribe);
                });
            });
            this.compute();
        } else if (this.normalizedDeps && isPlainObject(this.normalizedDeps)) {
            if (args.length === 2) {
                const key = args[0];
                const dep = args[1];
                this.normalizedDeps[key] = normalizeDependency(dep);
                const reactiveNodes = collectReactiveNodes(this.normalizedDeps[key]);
                reactiveNodes.forEach(node => {
                    const unsubscribe = node.subscribe(() => ReactiveNode.scheduleUpdate(this));
                    this._dependencySubscriptions.push(unsubscribe);
                });
            } else if (args.length === 1) {
                const arg = args[0];
                if (arg && typeof arg === 'object' && !arg.isDagifyNode && !Array.isArray(arg)) {
                    Object.keys(arg).forEach(key => {
                        this.normalizedDeps[key] = normalizeDependency(arg[key]);
                        const reactiveNodes = collectReactiveNodes(this.normalizedDeps[key]);
                        reactiveNodes.forEach(node => {
                            const unsubscribe = node.subscribe(() => ReactiveNode.scheduleUpdate(this));
                            this._dependencySubscriptions.push(unsubscribe);
                        });
                    });
                } else {
                    const dep = arg;
                    this.normalizedDeps[dep.id] = normalizeDependency(dep);
                    const reactiveNodes = collectReactiveNodes(this.normalizedDeps[dep.id]);
                    reactiveNodes.forEach(node => {
                        const unsubscribe = node.subscribe(() => ReactiveNode.scheduleUpdate(this));
                        this._dependencySubscriptions.push(unsubscribe);
                    });
                }
            } else {
                throw new Error("Invalid arguments to addDependency in named mode.");
            }
            this.compute();
        } else {
            throw new Error("Unsupported dependency type in addDependency");
        }
    }

    /**
     * Removes one or more dependencies from a computed node.
     *
     * Behavior:
     * - **Positional (array) mode:** Removes dependency(ies) from the dependency array.
     * - **Named (object) mode:** Removes dependencies by key, by passing a plain object, or by node reference.
     *
     * After removal, dependency subscriptions are refreshed.
     *
     * @param {...*} args - The dependency(ies) to remove.
     * @throws {Error} If called on a non-computed node.
     */
    removeDependency(...args) {
        if (!this.fn) throw new Error("Cannot remove dependency from a non-computed node.");
        if (Array.isArray(this.normalizedDeps)) {
            let depsToRemove = [];
            if (args.length === 1) {
                const arg = args[0];
                depsToRemove = Array.isArray(arg) ? arg : [arg];
            } else {
                depsToRemove = args;
            }
            depsToRemove.forEach(dep => {
                let index = this.normalizedDeps.indexOf(dep);
                if (index === -1 && typeof dep === "function") {
                    index = this.normalizedDeps.findIndex(normalized =>
                        normalized.isDagifyNode && normalized.fn === dep
                    );
                }
                if (index !== -1) {
                    this.normalizedDeps.splice(index, 1);
                    if (this._dependencySubscriptions && index < this._dependencySubscriptions.length) {
                        const unsubscribe = this._dependencySubscriptions[index];
                        unsubscribe();
                        this._dependencySubscriptions.splice(index, 1);
                    }
                }
            });
            this.compute();
        } else if (this.normalizedDeps && typeof this.normalizedDeps === 'object') {
            let keysToRemove = [];
            if (args.length === 1) {
                const arg = args[0];
                if (typeof arg === 'string') {
                    keysToRemove.push(arg);
                } else if (arg && typeof arg === 'object' && !arg.isDagifyNode && !Array.isArray(arg)) {
                    keysToRemove.push(...Object.keys(arg));
                } else if (arg && arg.isDagifyNode) {
                    Object.keys(this.normalizedDeps).forEach(key => {
                        if (this.normalizedDeps[key] === arg) {
                            keysToRemove.push(key);
                        }
                    });
                }
            } else if (args.length > 1) {
                args.forEach(arg => {
                    if (typeof arg === 'string') {
                        keysToRemove.push(arg);
                    } else if (arg && arg.isDagifyNode) {
                        Object.keys(this.normalizedDeps).forEach(key => {
                            if (this.normalizedDeps[key] === arg) {
                                keysToRemove.push(key);
                            }
                        });
                    }
                });
            } else {
                throw new Error("Invalid arguments to removeDependency in named mode.");
            }
            keysToRemove.forEach(key => {
                if (this.normalizedDeps[key]) {
                    delete this.normalizedDeps[key];
                }
            });
            this._unsubscribeDependencies();
            const reactiveNodes = collectReactiveNodes(this.normalizedDeps);
            this._dependencySubscriptions = reactiveNodes.map(dep =>
                dep.subscribe(() => ReactiveNode.scheduleUpdate(this))
            );
            this.compute();
        } else {
            throw new Error("Unsupported dependency type in removeDependency");
        }
    }

    /**
     * Lists the IDs of all reactive dependencies.
     *
     * @returns {Array<string>} An array of dependency IDs.
     */
    listDependencies() {
        const nodes = collectReactiveNodes(this.normalizedDeps);
        return nodes.map(dep => dep.id);
    }

    /**
     * Subscribes to an RxJS Observable, updating the node's value based on emissions.
     *
     * @param {Observable} obs - The observable to subscribe to.
     * @private
     */
    _subscribeToObservable(obs) {
        if (this._observableSubscription) {
            this._observableSubscription.unsubscribe();
        }
        this._observableSubscription = obs.subscribe(
            value => this._setValue(value),
            err => this.error(err),
            () => this.complete()
        );
    }

    /**
     * Converts the node into an RxJS Observable.
     *
     * @returns {Observable} An observable that emits the node's value.
     */
    toObservable() {
        return new Observable(subscriber => {
            if (this.value !== undefined) {
                subscriber.next(this.value);
            }
            const unsubscribe = this.subscribe({
                next: value => subscriber.next(value),
                error: err => subscriber.error(err),
                complete: () => subscriber.complete()
            });
            return unsubscribe;
        });
    }

    /**
     * Updates the node's value.
     *
     * For computed nodes, this triggers recomputation.
     * For static nodes, if a function is provided, it updates based on the function's result;
     * if no argument is provided, forces a re-emission; otherwise, sets the node to the new value.
     *
     * @param {Function|*} [fnOrValue] - The new value or a function to update the current value.
     */
    update(fnOrValue) {
        if (this.fn) {
            this.compute();
        } else {
            if (typeof fnOrValue === 'function') {
                const newValue = fnOrValue(this.value);
                this.set(newValue);
            } else if (fnOrValue === undefined) {
                this._setValue(this.value, true);
            } else {
                this.set(fnOrValue);
            }
        }
    }

    /**
     * Updates the dependency structure of a computed node.
     * The provided update function receives the current dependency structure and must return an updated structure.
     *
     * @param {Function} updateFn - A function that takes the current dependency structure and returns a new one.
     * @throws {Error} If called on a non-computed node.
     */
    updateDependencies(updateFn) {
        if (!this.fn) throw new Error("Cannot update dependencies on a non-computed node.");
        const updatedDeps = updateFn(this.normalizedDeps);
        this.normalizedDeps = updatedDeps;
        this._unsubscribeDependencies();
        const reactiveNodes = collectReactiveNodes(this.normalizedDeps);
        this._dependencySubscriptions = reactiveNodes.map(dep =>
            dep.subscribe(() => ReactiveNode.scheduleUpdate(this))
        );
        this.compute();
    }
}

export { ReactiveNode };
