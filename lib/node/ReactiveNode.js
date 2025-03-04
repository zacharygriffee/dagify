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
import { types } from "../types/index.js";
import { encodeValue, decodeValue } from "../encoding/index.js";

/**
 * Represents a reactive node in a directed acyclic graph (DAG).
 * Supports computed values, subscriptions, error handling, and completion.
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
        this._metadata = config.metadata || {};
        this._type = this._metadata.type || config.type || "any";
        // For backwards compatibility, default encoding is "any" (meaning no encoding)
        this._valueEncoding = this._metadata.valueEncoding || config.valueEncoding || "any";

        this._dependencyErrorSubject = new ReplaySubject(undefined, config.errorRetentionTime || 5000);
        this._skip = config.skip || 0;
        this._isSink = config.sink || false;

        this._encodedId = null;
        this.subscribers = new Set();
        this._completed = false;
        // Internal flag so that internal updates (e.g. in compute or constructor) bypass the computed-node check.
        this._internalUpdate = false;

        if (isComputed) {
            this.fn = fnOrValue;
            // Allow internal assignment for computed nodes.
            this._internalUpdate = true;
            this.value = NO_EMIT;
            this._internalUpdate = false;
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
                // For static nodes, assign via the setter.
                this.value = fnOrValue === undefined ? NO_EMIT : fnOrValue;
            }
        }

        this._key = config.key || currentKeyGenerator(this);
    }

    get dependencyError$() {
        return this._dependencyErrorSubject.asObservable();
    }

    get isDagifyNode() {
        return true;
    }

    get isSink() {
        return this._isSink;
    }

    get unbatched() {
        return this.disableBatching;
    }

    get isAsync() {
        return !!this._isAsync;
    }

    get isComputed() {
        return !!this.fn;
    }

    get isActive() {
        return this.value !== NO_EMIT;
    }

    get id() {
        if (!this._encodedId) {
            this._encodedId = z32.encode(this.key);
        }
        return this._encodedId;
    }

    get key() {
        return this._key;
    }

    set key(value) {
        if (value.byteLength !== 32) throw new Error("Key must be 32 byte buffer.");
        this._key = value;
    }

    get skip() {
        return this.pipe(skip(1));
    }

    get once() {
        return this.toObservable().pipe(take(1));
    }

    get type() {
        return this._type;
    }

    set type(value) {
        this._type = value;
    }

    get valueEncoding() {
        return this._valueEncoding;
    }

    set valueEncoding(value) {
        this._valueEncoding = value;
    }

    get metadata() {
        return this._metadata;
    }

    set metadata(value) {
        this._metadata = value;
    }

    /**
     * If an encoding is active (i.e. not "any"), returns the decoded value.
     * Otherwise, returns the stored raw value.
     */
    get value() {
        if (this._encodedValue !== null &&
            this._valueEncoding &&
            this._valueEncoding !== "any") {
            if (Buffer.isBuffer(this._encodedValue)) {
                try {
                    return decodeValue(this._encodedValue, this._valueEncoding);
                } catch (err) {
                    // Emit or throw error if decoding fails.
                    throw new Error(`Failed to decode value: ${err.message}`);
                }
            } else {
                // If the encoded value isn't a Buffer, we defer to type checking.
                return this._value;
            }
        }
        return this._value;
    }

    /**
     * Sets the node's value.
     *
     * For computed nodes (i.e. when a computation function exists), external calls
     * to set the value are disallowed.
     *
     * If an encoding is set (and isn’t "any"), the value is encoded and stored.
     * Otherwise, the raw value is stored.
     *
     * Internal updates (via the `_internalUpdate` flag) bypass the computed-node check.
     */
    set value(newValue) {
        // If newValue is a Buffer and a valid encoding is provided, decode it first.
        if (Buffer.isBuffer(newValue) &&
            this._valueEncoding &&
            this._valueEncoding !== "any") {
            try {
                newValue = decodeValue(newValue, this._valueEncoding);
            } catch (err) {
                throw new Error(`Failed to decode value: ${err.message}`);
            }
        }

        // Now validate the (possibly decoded) newValue against the type.
        if (!this._validateType(newValue)) {
            const typeErr = new Error(`Type mismatch: value does not conform to type "${this._type}"`);
            this.error(typeErr);
            return;
        }

        // Set the raw value.
        this._value = newValue;

        // If an encoding is set, encode the newValue (which is now a proper type) for internal storage.
        if (this._valueEncoding && this._valueEncoding !== "any") {
            try {
                this._encodedValue = encodeValue(newValue, this._valueEncoding);
            } catch (err) {
                console.warn("Failed to encode value:", err);
                this._encodedValue = null;
            }
        } else {
            this._encodedValue = null;
        }
    }


    get diff() {
        return this.pipe(diffOperator());
    }

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

    static batch(fn) {
        ReactiveNode.batchMode = true;
        fn();
        ReactiveNode.batchMode = false;
        ReactiveNode.pendingUpdates.forEach(n => n.compute());
        ReactiveNode.pendingUpdates.clear();
    }

    _validateType(newValue) {
        if (this._type === "any") return true;
        const validator = types.getType(this._type);
        if (!validator) return true;
        return validator(newValue);
    }

    getId() {
        return z32.encode(this.key);
    }

    filterDependencyErrors(depValue, normalizedDeps, errorSubject) {
        let errorFound = false;
        let values, newNormalized;

        if (depValue && depValue.isDagifyNode) {
            if (depValue._error instanceof Error) {
                errorSubject.next(depValue._error);
                return { valid: false };
            }
            return { valid: true, values: depValue, normalized: normalizedDeps };
        }

        if (depValue instanceof Error) {
            errorSubject.next(depValue);
            return { valid: false };
        }

        if (Array.isArray(depValue)) {
            values = [];
            newNormalized = [];
            for (let i = 0; i < depValue.length; i++) {
                let value = depValue[i];
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
                values.push(value);
                newNormalized.push(normalizedDeps[i]);
            }
            return { valid: !errorFound, values, normalized: newNormalized };
        }

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

        return { valid: true, values: depValue, normalized: normalizedDeps };
    }

    compute() {
        if (!this.fn) return;
        try {
            const depValue = getDependencyValue(this.normalizedDeps);

            if (Array.isArray(depValue) && depValue.some(val => val === NO_EMIT)) return;
            if (isPlainObject(depValue)) {
                for (const key in depValue) {
                    if (depValue[key] === NO_EMIT) return;
                }
            }
            if (!Array.isArray(depValue) && !isPlainObject(depValue) && depValue === NO_EMIT) return;

            const filtered = this.filterDependencyErrors(depValue, this.normalizedDeps, this._dependencyErrorSubject);
            if (!filtered.valid) {
                this.normalizedDeps = filtered.normalized;
                return;
            }

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
            this._error = undefined;
        } catch (err) {
            console.warn(err);
            this._value = err;
            this._dependencyErrorSubject.next(err);
            this._error = err;
            this._notifyAll('error', err);
        }
    }

    set(newValue) {
        if (this.fn) throw new Error("Cannot manually set a computed node");

        if (!this._validateType(newValue)) {
            const typeErr = new Error(`Type mismatch: value does not conform to type "${this._type}"`);
            this.error(typeErr);
            return;
        }

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

    next(value) {
        this.fn ? this.compute() : this.set(value);
    }

    subscribe(observer) {
        return this._subscribeCore(observer);
    }

    subscribeOnce(observer) {
        return this.toObservable().pipe(take(1)).subscribe(observer);
    }

    error(err) {
        this.finalize(err);
        this._notifyAll('error', err);
    }

    complete() {
        this._completed = true;
        this._notifyAll('complete');
        this.subscribers.clear();
        this._unsubscribeDependencies();
        this.finalize();
        if (this._observableSubscription) {
            this._observableSubscription.unsubscribe();
            this._observableSubscription = null;
        }
    }

    /**
     * Internal method to update the node's value and notify subscribers.
     * If newValue equals NO_EMIT, no update is made.
     * It uses the public setter so that encoding happens automatically.
     *
     * @param {*} newValue - The new value.
     * @param {boolean} [forceEmit=false] - If true, forces emission even if unchanged.
     */
    _setValue(newValue, forceEmit = false) {
        if (newValue === NO_EMIT) return;
        if (!this._validateType(newValue)) {
            const typeErr = new Error(`Type mismatch: value does not conform to type "${this._type}"`);
            this.error(typeErr);
            return;
        }
        const prevValue = this.value;
        this._internalUpdate = true;
        this.value = newValue;
        this._internalUpdate = false;
        if (forceEmit || !deepEqual(prevValue, newValue)) {
            this._notifyAll('next', newValue);
        }
    }

    encodeForSink() {
        if (!this._valueEncoding || this._valueEncoding === "any") {
            throw new Error(`Node does not have an encoding set.`);
        }
        return encodeValue(this.value, this._valueEncoding);
    }

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
            this.onUnsubscribe(this.subscribers.size);
            if (this.subscribers.size === 0) {
                this._unsubscribeDependencies();
            }
        };
        unsubscribe.unsubscribe = unsubscribe;
        return unsubscribe;
    }

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

    _notifyAll(type, value) {
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

    _unsubscribeDependencies() {
        this._dependencySubscriptions?.forEach(unsubscribe => unsubscribe());
        this._dependencySubscriptions = [];
    }

    setDependencies(dependencies) {
        if (!this.fn) throw new Error("Cannot set dependency to a non-computed node.");
        this.normalizedDeps = dependencies !== undefined ? normalizeDependency(dependencies) : [];
        const reactiveNodes = collectReactiveNodes(this.normalizedDeps);
        this._dependencySubscriptions = reactiveNodes.map(dep =>
            dep.subscribe(() => ReactiveNode.scheduleUpdate(this))
        );
        this.compute();
    }

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
