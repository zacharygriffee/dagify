import { Observable, Subject, skip, take, defer, from } from './rxjs/rxjsPrebuilt.js';
import { fromObservable } from "./util/fromObservable.js";
import { isRxObservable } from "./rxjs/isRxObservable.js";
import { deepEqual } from "./util/deepEqual.js";

let idGenerator = () => `Node-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Sets the function used to generate unique node IDs.
 *
 * @param {function} generator - A function that returns a string identifier for nodes.
 */
const setIdGenerator = (generator) => idGenerator = generator;

/**
 * Normalizes a dependency into its “reactive” form:
 * - Arrays are recursively normalized.
 * - Plain objects have each property normalized.
 * - Functions (that are not dagify nodes) are wrapped so that each subscription gets a fresh value.
 *
 * @param {*} dep - The dependency to normalize.
 * @returns {*} The normalized dependency.
 */
function normalizeDependency(dep) {
    if (Array.isArray(dep)) {
        return dep.map(normalizeDependency);
    } else if (dep && typeof dep === 'object') {
        // If it's already a dagify node, leave it as is.
        if (dep.isDagifyNode) return dep;
        // If it's an RxObservable, wrap it.
        if (isRxObservable(dep)) return fromObservable(dep, undefined);
        // Otherwise, assume it’s a plain object with dependencies.
        const result = {};
        for (const key in dep) {
            result[key] = normalizeDependency(dep[key]);
        }
        return result;
    } else if (typeof dep === 'function') {
        // Wrap function dependencies so that each subscription re-evaluates them.
        return from(defer(() => Promise.resolve(dep())));
    }
    // For static values, return as is.
    return dep;
}

/**
 * Recursively collects all reactive nodes (or observables) from a dependency structure.
 *
 * @param {*} dep - A normalized dependency.
 * @returns {Array} An array of reactive nodes.
 */
function collectReactiveNodes(dep) {
    if (Array.isArray(dep)) {
        return dep.flatMap(collectReactiveNodes);
    } else if (dep && typeof dep === 'object') {
        // If the object itself is a dagify node or an observable, return it.
        if (dep.isDagifyNode || isRxObservable(dep)) {
            return [dep];
        }
        // Otherwise, process each property.
        return Object.values(dep).flatMap(collectReactiveNodes);
    }
    return [];
}

/**
 * Recursively retrieves the current value from a dependency structure,
 * preserving its shape (array, object, or single value).
 *
 * @param {*} dep - A normalized dependency.
 * @returns {*} The current value.
 */
function getDependencyValue(dep) {
    if (Array.isArray(dep)) {
        return dep.map(getDependencyValue);
    } else if (dep && typeof dep === 'object') {
        if (dep.isDagifyNode || isRxObservable(dep)) {
            return dep.value;
        }
        const result = {};
        for (const key in dep) {
            result[key] = getDependencyValue(dep[key]);
        }
        return result;
    }
    return dep;
}

/**
 * Represents a reactive node in a directed acyclic graph (DAG).
 * Supports computed values, subscriptions, error handling, and completion.
 *
 * Note: Computed nodes now use only a single dependency argument (either an array for positional
 * dependencies or an object for named dependencies). The older multiple-argument API is no longer supported.
 *
 * @class ReactiveNode
 * @extends {Subject}
 */
class ReactiveNode extends Subject {
    static pendingUpdates = new Set();
    static updating = false;
    static batchMode = false;

    get isDagifyNode() {
        return true;
    }

    get isAsync() {
        return !!this._isAsync;
    }

    get isComputed() {
        return !!this.fn;
    }

    get id() {
        return this.getId();
    }

    getId() {
        return this._id ||= idGenerator();
    }

    /**
     * Creates a new ReactiveNode.
     *
     * For computed nodes, the first argument must be a function and the second argument must be a single dependency
     * argument (either an array for positional dependencies or an object for named dependencies).
     *
     * For static nodes, any non-function value is treated as a static value.
     *
     * @param {Function|*} fnOrValue - A function for computed nodes or a static value.
     * @param {...*} dependencies - For computed nodes, a single dependency argument.
     */
    constructor(fnOrValue, ...dependencies) {
        super();

        this.subscribers = new Set();
        this._completed = false;

        if (typeof fnOrValue === 'function') {
            // Computed node.
            this.fn = fnOrValue;
            // Enforce that exactly one dependency argument is provided.
            if (dependencies.length !== 1) {
                throw new Error("Computed nodes require a single dependency argument: either an array (positional) or an object (named).");
            }
            // Normalize the single dependency argument.
            this.normalizedDeps = normalizeDependency(dependencies[0]);
            // Subscribe to all reactive dependencies.
            const reactiveNodes = collectReactiveNodes(this.normalizedDeps);
            this._dependencySubscriptions = reactiveNodes.map(dep =>
                dep.subscribe(() => ReactiveNode.scheduleUpdate(this))
            );
            // Perform the initial computation.
            this.compute();
        } else {
            // Static node.
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

    static batch(fn) {
        ReactiveNode.batchMode = true;
        fn();
        ReactiveNode.batchMode = false;
        ReactiveNode.pendingUpdates.forEach(n => n.compute());
        ReactiveNode.pendingUpdates.clear();
    }

    /**
     * Computes the node's value.
     *
     * In positional mode:
     *  - If the computed function declares exactly one parameter, the dependency array is passed as-is.
     *  - Otherwise (e.g. a rest-parameter function), the dependency array is spread into individual arguments.
     *
     * For named dependencies (object), the dependency is always passed as a single argument.
     */
    compute() {
        if (!this.fn) return;
        try {
            const depValue = getDependencyValue(this.normalizedDeps);
            let result;
            if (Array.isArray(this.normalizedDeps) && this.fn.length !== 1) {
                // Spread the dependency array into separate arguments.
                result = this.fn(...depValue);
            } else {
                // Pass the dependency as a single argument.
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
    }

    next(value) {
        this.fn ? this.compute() : this.set(value);
    }

    subscribe(observer) {
        return this._subscribeCore(observer);
    }

    get skip() {
        return this.pipe(skip(1));
    }

    subscribeOnce(observer) {
        return this.toObservable().pipe(take(1)).subscribe(observer);
    }

    get once() {
        return this.toObservable().pipe(take(1));
    }

    error(err) {
        this._notifyAll('error', err);
    }

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

    _setValue(newValue) {
        const prevValue = this.value;
        this.value = newValue;
        if (!deepEqual(prevValue, newValue)) {
            this._notifyAll('next', newValue);
        }
    }

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

    _unsubscribeDependencies() {
        this._dependencySubscriptions?.forEach(unsubscribe => unsubscribe());
        this._dependencySubscriptions = [];
    }

    /**
     * Unified method to add a dependency.
     *
     * Behavior depends on the current dependency structure:
     *
     * - **Positional (array) mode:**
     *   If the node was created with an array dependency, then:
     *     - If multiple arguments are provided or a single array is provided, the new dependency(ies)
     *       are appended.
     *
     * - **Named (object) mode:**
     *   If the node was created with an object dependency, then:
     *     - If two arguments are provided, they are treated as key and dependency.
     *     - If a single argument is provided:
     *         - If it is a plain object, its key/value pairs are merged.
     *         - Otherwise, the dependency is added with the node’s id as key.
     *
     * @param {...*} args - See above.
     */
    addDependency(...args) {
        if (!this.fn) {
            throw new Error("Cannot add dependency to a non-computed node.");
        }
        // Positional mode: normalizedDeps is an array.
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
        }
        // Named mode: normalizedDeps is an object.
        else if (this.normalizedDeps && typeof this.normalizedDeps === 'object') {
            if (args.length === 2) {
                // (key, dep) provided.
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
                // If arg is a plain object (and not a dagify node), merge its key/value pairs.
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
                    // Otherwise, assume it's a single dependency; use its id as key.
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
     * Unified method to remove a dependency.
     *
     * Behavior depends on the current dependency structure:
     *
     * - **Positional (array) mode:**
     *   If the node was created with an array dependency, then:
     *     - If multiple arguments are provided or a single array is provided, the dependency(ies)
     *       are removed from the list.
     *
     * - **Named (object) mode:**
     *   If the node was created with an object dependency, then:
     *     - If a string (or multiple strings) is provided, they are used as keys to remove.
     *     - If a plain object is provided, its keys are removed.
     *     - If a node is provided, the dependency object is scanned for values that strictly equal
     *       the provided node, and those keys are removed.
     *
     * After removal, subscriptions are refreshed.
     *
     * @param {...*} args - See above.
     */
    removeDependency(...args) {
        if (!this.fn) {
            throw new Error("Cannot remove dependency from a non-computed node.");
        }
        // Positional mode: normalizedDeps is an array.
        if (Array.isArray(this.normalizedDeps)) {
            let depsToRemove = [];
            if (args.length === 1) {
                const arg = args[0];
                depsToRemove = Array.isArray(arg) ? arg : [arg];
            } else {
                depsToRemove = args;
            }
            depsToRemove.forEach(dep => {
                const index = this.normalizedDeps.indexOf(dep);
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
        }
        // Named mode: normalizedDeps is an object.
        else if (this.normalizedDeps && typeof this.normalizedDeps === 'object') {
            let keysToRemove = [];
            if (args.length === 1) {
                const arg = args[0];
                if (typeof arg === 'string') {
                    keysToRemove.push(arg);
                } else if (arg && typeof arg === 'object' && !arg.isDagifyNode && !Array.isArray(arg)) {
                    // If a plain object is passed, remove keys from it.
                    keysToRemove.push(...Object.keys(arg));
                } else if (arg && arg.isDagifyNode) {
                    // Instead of assuming arg.id, iterate and remove based on reference equality.
                    Object.keys(this.normalizedDeps).forEach(key => {
                        if (this.normalizedDeps[key] === arg) {
                            keysToRemove.push(key);
                        }
                    });
                }
            } else if (args.length > 1) {
                // If multiple arguments are provided, treat each.
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
            // Refresh dependency subscriptions.
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
     * @returns {Array} An array of dependency IDs.
     */
    listDependencies() {
        const nodes = collectReactiveNodes(this.normalizedDeps);
        return nodes.map(dep => dep.id);
    }

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

    update(fn) {
        if (this.fn) {
            this.compute();
        } else {
            if (typeof fn === 'function') {
                const newValue = fn(this.value);
                this.set(newValue);
            } else {
                throw new Error("update() requires a function argument for stateful nodes");
            }
        }
    }

    /**
     * Updates the dependency structure.
     * The provided update function receives the current dependency structure (i.e. the array or object)
     * and must return a new dependency structure.
     *
     * For example:
     *
     * // For named dependencies:
     * node.updateDependencies(deps => {
     *    return { ...deps, newDep: newNode };
     * });
     *
     * // For positional dependencies:
     * node.updateDependencies(deps => {
     *    deps.push(newNode);
     *    return deps;
     * });
     *
     * @param {Function} updateFn - Function that receives the current dependency structure and returns the updated structure.
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

export { ReactiveNode, setIdGenerator };
