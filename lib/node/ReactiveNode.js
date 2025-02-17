import {Observable, skip, Subject, take} from '../rxjs/rxjsPrebuilt.js';
import {isRxObservable} from "../rxjs/isRxObservable.js";
import {deepEqual} from "../util/deepEqual.js";
import {keyGenerator, keyToZ32} from "../util/keyGenerator.js";
import {normalizeDependency} from "./normalizeDependency.js";
import {collectReactiveNodes} from "./collectReactiveNodes.js";
import {getDependencyValue} from "./getDependencyValue.js";

/**
 * Represents a reactive node in a directed acyclic graph (DAG).
 * Supports computed values, subscriptions, error handling, and completion.
 *
 * **Note:** Computed nodes now use only a single dependency argument (either an array for positional
 * dependencies or an object for named dependencies). The older multiple-argument API is no longer supported.
 *
 * @class ReactiveNode
 * @extends {Subject}
 */
class ReactiveNode extends Subject {
    static pendingUpdates = new Set();
    static updating = false;
    static batchMode = false;

    /**
     * Creates a new ReactiveNode.
     *
     * For computed nodes, the first argument must be a function. An optional second argument can be provided
     * as the dependency (either an array for positional dependencies or an object for named dependencies). If omitted,
     * the computed node is created without dependencies.
     *
     * For static nodes, any non-function value is treated as a static value, and the dependency argument is ignored.
     *
     * @param {Function|*} fnOrValue - A function for computed nodes or a static value.
     * @param {*} [dependencies] - (Optional) For computed nodes, a single dependency argument.
     */
    constructor(fnOrValue, dependencies) {
        super();

        this._key ||= keyGenerator();
        this._encodedId = null;
        this.subscribers = new Set();
        this._completed = false;

        if (typeof fnOrValue === 'function') {
            this.fn = fnOrValue;
            // If dependencies is undefined, create a dependency-less computed node.
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
                this.value = fnOrValue;
            }
        }
    }

    /**
     * Indicates that this is a Dagify node.
     * @type {boolean}
     */
    get isDagifyNode() {
        return true;
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

    /**
     * Returns the unique identifier for this node.
     * @type {string}
     */
    get id() {
        if (!this._encodedId) {
            this._encodedId = keyToZ32(this._key);
        }
        return this._encodedId;
    }

    get key() {
        return this._key;
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
     * Schedules an update for the given node.
     * @param {ReactiveNode} node - The node to update.
     */
    static scheduleUpdate(node) {
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
        return keyToZ32(this.key);
    }

    /**
     * Computes the node's value.
     *
     * For positional dependencies:
     *  - If the computed function declares exactly one parameter, the dependency array is passed as-is.
     *  - Otherwise, the dependency array is spread into individual arguments.
     *
     * For named dependencies, the dependency is always passed as a single argument.
     */
    compute() {
        if (!this.fn) return;
        try {
            const depValue = getDependencyValue(this.normalizedDeps);
            let result;
            if (Array.isArray(this.normalizedDeps) && this.fn.length !== 1) {
                result = this.fn(...depValue);
            } else {
                result = this.fn(depValue);
            }

            this._isAsync = false;
            if (result && typeof result.subscribe === 'function') {
                this._isAsync = true;
                if (this._asyncSubscription) {
                    this._asyncSubscription.unsubscribe();
                }
                this._asyncSubscription = result.subscribe(
                    newValue => this._setValue(newValue),
                    err => this.error(err)
                );
            } else if (result && typeof result.then === 'function') {
                this._isAsync = true;
                Promise.resolve(result)
                    .then(newValue => this._setValue(newValue))
                    .catch(err => this.error(err));
            } else {
                if (!deepEqual(this._lastComputed, result)) {
                    this._lastComputed = result;
                    this._setValue(result);
                }
            }
            this._error = undefined;
        } catch (err) {
            this._error = err;
            this._notifyAll('error', err);
        }
    }

    /**
     * Sets a new value for a static node.
     * If the node is computed, an error is thrown.
     * Returns a promise that resolves on the next tick.
     * awaiting this promise is optional.
     *
     * @param {*} newValue - The new value to set.
     * @returns {Promise<void>} A promise that resolves after the value update is processed.
     * @throws Will throw an error if called on a computed node.
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
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    /**
     * For static nodes, behaves like set(). For computed nodes, triggers recomputation.
     * @param {*} value - New value or function to update the node.
     */
    next(value) {
        this.fn ? this.compute() : this.set(value);
    }

    /**
     * Subscribes to value changes on the node.
     * @param {Function|Object} observer - A function or an observer object.
     * @returns {Function} A function to unsubscribe.
     */
    subscribe(observer) {
        return this._subscribeCore(observer);
    }

    /**
     * Subscribes to the node and automatically unsubscribes after one emission.
     * @param {Function|Object} observer - A function or observer object.
     * @returns {Function} A function to unsubscribe.
     */
    subscribeOnce(observer) {
        return this.toObservable().pipe(take(1)).subscribe(observer);
    }

    /**
     * Notifies subscribers of an error.
     * @param {Error} err - The error to notify.
     */
    error(err) {
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
        if (this._observableSubscription) {
            this._observableSubscription.unsubscribe();
            this._observableSubscription = null;
        }
    }

    /**
     * Internal method to update the node's value and notify subscribers.
     *
     * @param {*} newValue - The new value to set.
     * @param {boolean} [forceEmit=false] - Whether to force an emission even if the value is unchanged.
     */
    _setValue(newValue, forceEmit = false) {
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
        if (this._completed) {
            if (typeof observer.complete === 'function') observer.complete();
            return () => {};
        }

        const subscriber = this._initializeObserver(observer);
        this.subscribers.add(subscriber);

        if (typeof subscriber.next === 'function') {
            if (this._error !== undefined) {
                if (typeof subscriber.error === 'function') {
                    subscriber.error(this._error);
                }
                subscriber.closed = true;
            } else {
                subscriber.next(this.value);
                subscriber.lastEmitted = this.value;
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
            if (this.subscribers.size === 0) this._unsubscribeDependencies();
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
        if (observer && typeof observer._next === 'function') {
            return observer;
        }
        if (!observer) {
            observer = {};
        }
        if (typeof observer === 'function') {
            observer = { next: observer };
        }
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
        this.subscribers.forEach(subscriber => {
            if (subscriber.closed) return;
            queueMicrotask(() => {
                if (type === 'error' && !subscriber.errorNotified && typeof subscriber.error === 'function') {
                    subscriber.error(value);
                    subscriber.errorNotified = true;
                    subscriber.closed = true;
                } else if (type === 'next') {
                    subscriber.lastEmittedQueue = subscriber.lastEmittedQueue || [];
                    subscriber.lastEmittedQueue.push(value);
                    while (subscriber.lastEmittedQueue.length > 0) {
                        const nextValue = subscriber.lastEmittedQueue.shift();
                        subscriber.next?.(nextValue);
                        subscriber.lastEmitted = nextValue;
                    }
                } else if (type === 'complete' && typeof subscriber.complete === 'function') {
                    subscriber.complete();
                    subscriber.closed = true;
                }
            });
        });
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
     * Adds one or more dependencies to a computed node.
     *
     * Behavior:
     * - **Positional (array) mode:** If the node was created with an array dependency,
     *   the new dependency(ies) are appended.
     * - **Named (object) mode:** If created with an object dependency, keys are added or merged.
     *
     * @param {...*} args - The dependency(ies) to add.
     * @throws Will throw an error if called on a non-computed node.
     */
    addDependency(...args) {
        if (!this.fn) {
            throw new Error("Cannot add dependency to a non-computed node.");
        }
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
        } else if (this.normalizedDeps && typeof this.normalizedDeps === 'object') {
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
     * @throws Will throw an error if called on a non-computed node.
     */
    removeDependency(...args) {
        if (!this.fn) {
            throw new Error("Cannot remove dependency from a non-computed node.");
        }
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
     * @throws Will throw an error if called on a non-computed node.
     */
    updateDependencies(updateFn) {
        if (!this.fn) {
            throw new Error("Cannot update dependencies on a non-computed node.");
        }
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
