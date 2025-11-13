import { ReactiveNode } from "./ReactiveNode.js";
import { ShallowReactiveNode } from "../shallow-node/ShallowReactiveNode.js";
import { collectReactiveNodes } from "./collectReactiveNodes.js";
import { isPlainObject } from "../util/IsPlainObject.js";
import { deepEqual } from "../util/deepEqual.js";
import { NO_EMIT } from "./NO_EMIT.js";

const OVERFLOW_ACTIONS = new Set(["drop-newest", "drop-oldest", "error", "enqueue"]);
const DEFAULT_OVERFLOW_STRATEGY = "drop-newest";

const withQueueing = (BaseClass) => class QueuedNode extends BaseClass {
    constructor(fnOrValue, dependencies, config = {}) {
        super(fnOrValue, dependencies, config);
        this._initializeQueueOptions(config);
        if (this.fn) {
            this._ensureQueueSupport();
        }
    }

    _initializeQueueOptions(config = {}) {
        const queueConfig = config || {};
        const maxQueueLength = queueConfig.maxQueueLength;
        if (maxQueueLength === undefined || maxQueueLength === null) {
            this._maxQueueLength = Infinity;
        } else {
            if (typeof maxQueueLength !== "number" || !Number.isFinite(maxQueueLength) || maxQueueLength < 1) {
                throw new Error("maxQueueLength must be a positive, finite number.");
            }
            this._maxQueueLength = maxQueueLength;
        }
        const strategy = queueConfig.overflowStrategy || DEFAULT_OVERFLOW_STRATEGY;
        if (!OVERFLOW_ACTIONS.has(strategy) || strategy === "enqueue") {
            throw new Error(`Invalid overflowStrategy "${strategy}". Expected "drop-newest", "drop-oldest", or "error".`);
        }
        this._overflowStrategy = strategy;
        this._overflowNotifier = typeof queueConfig.onOverflow === "function" ? queueConfig.onOverflow : null;
        this._snapshotQueue = [];
    }

    _ensureQueueSupport() {
        if (this._queueInitialized || !this.fn) return;
        this._queueInitialized = true;
        this._queueTail = Promise.resolve();
        this._dependencyValueMap = new Map();
        this._snapshotQueue ||= [];
        this._replaceDependencySubscriptions();
    }

    _replaceDependencySubscriptions() {
        this._unsubscribeDependencies();
        const reactiveNodes = collectReactiveNodes(this.normalizedDeps);
        this._dependencySubscriptions = reactiveNodes.map(dep =>
            dep.subscribe({
                next: (value) => this._handleDependencyEmission(dep, value),
                error: (err) => this._handleDependencyError(err)
            })
        );
        this._seedDependencyCache();
    }

    _seedDependencyCache() {
        this._dependencyValueMap?.clear();
        this._cacheDependencyValues(this.normalizedDeps);
    }

    _cacheDependencyValues(dep) {
        if (Array.isArray(dep)) {
            dep.forEach(inner => this._cacheDependencyValues(inner));
            return;
        }
        if (dep && dep.isDagifyNode) {
            this._dependencyValueMap.set(dep, dep.value);
            return;
        }
        if (dep && typeof dep === "object") {
            for (const key in dep) {
                this._cacheDependencyValues(dep[key]);
            }
        }
    }

    _handleDependencyEmission(dep, value) {
        if (dep && dep.isDagifyNode) {
            this._dependencyValueMap.set(dep, value);
        }
        if (this.enableActivityThresholding) {
            this.activityLevel++;
            this.lastVisited = Date.now();
            if (this.activityLevel >= this.activationThreshold) {
                this.activityLevel = 0;
                this._enqueueSnapshot();
            }
        } else {
            this._enqueueSnapshot();
        }
    }

    _handleDependencyError(err) {
        this._dependencyErrorSubject.next(err);
        this.error(err);
    }

    compute() {
        if (!this.fn) return;
        this._ensureQueueSupport();
        this._enqueueSnapshot();
    }

    _enqueueSnapshot() {
        const snapshot = this._captureSnapshot();
        if (!snapshot) return;
        if (!this._canAcceptSnapshot()) {
            if (!this._handleOverflow(snapshot)) {
                return;
            }
        }
        this._acceptSnapshot(snapshot);
    }

    _acceptSnapshot(snapshot) {
        this._snapshotQueue.push(snapshot);
        this._queueTail = this._queueTail
            .then(() => this._consumeSnapshot())
            .catch(() => {});
    }

    _canAcceptSnapshot() {
        return this._snapshotQueue.length < this._maxQueueLength;
    }

    async _consumeSnapshot() {
        const snapshot = this._snapshotQueue.shift();
        if (!snapshot) return;
        await this._executeSnapshot(snapshot);
    }

    _captureSnapshot() {
        const depValue = this._getCachedDependencyValues(this.normalizedDeps);
        if (this._containsNoEmit(depValue)) return null;
        const filtered = this.filterDependencyErrors(depValue, this.normalizedDeps, this._dependencyErrorSubject);
        if (!filtered.valid) {
            this.normalizedDeps = filtered.normalized;
            this._seedDependencyCache();
            return null;
        }
        const spreadArgs = Array.isArray(this.normalizedDeps) && this.fn.length !== 1;
        const args = spreadArgs ? filtered.values : [filtered.values];
        return { args, spreadArgs };
    }

    _handleOverflow(snapshot) {
        if (this._maxQueueLength === Infinity) {
            return true;
        }
        const action = this._resolveOverflowAction(snapshot);
        if (action === "enqueue") {
            return true;
        }
        if (action === "drop-oldest") {
            const dropped = this._snapshotQueue.shift();
            return dropped !== undefined;
        }
        if (action === "drop-newest") {
            return false;
        }
        if (action === "error") {
            const err = new Error("Queued node overflow: queue reached its maxQueueLength.");
            this.error(err);
            return false;
        }
        return false;
    }

    _resolveOverflowAction(snapshot) {
        let action = this._overflowStrategy;
        if (this._overflowNotifier) {
            try {
                const result = this._overflowNotifier({
                    strategy: this._overflowStrategy,
                    queueLength: this._snapshotQueue.length,
                    incoming: snapshot.args
                });
                if (result && OVERFLOW_ACTIONS.has(result)) {
                    action = result;
                }
            } catch (err) {
                console.warn("onOverflow callback threw:", err);
            }
        }
        return action;
    }

    _getCachedDependencyValues(dep) {
        if (Array.isArray(dep)) {
            return dep.map(inner => this._getCachedDependencyValues(inner));
        }
        if (dep && dep.isDagifyNode) {
            if (this._dependencyValueMap && this._dependencyValueMap.has(dep)) {
                return this._dependencyValueMap.get(dep);
            }
            const value = dep.value;
            this._dependencyValueMap?.set(dep, value);
            return value;
        }
        if (dep && typeof dep === "object") {
            const result = {};
            for (const key in dep) {
                result[key] = this._getCachedDependencyValues(dep[key]);
            }
            return result;
        }
        return dep;
    }

    _containsNoEmit(value) {
        if (Array.isArray(value)) {
            return value.some(val => val === NO_EMIT);
        }
        if (isPlainObject(value)) {
            for (const key in value) {
                if (value[key] === NO_EMIT) return true;
            }
            return false;
        }
        return value === NO_EMIT;
    }

    async _executeSnapshot(snapshot) {
        try {
            let result;
            if (snapshot.spreadArgs) {
                result = this.fn(...snapshot.args);
            } else {
                result = this.fn(snapshot.args[0]);
            }
            this._isAsync = false;
            if (result && typeof result.subscribe === "function") {
                this._isAsync = true;
                await this._resolveObservable(result);
            } else if (result && typeof result.then === "function") {
                this._isAsync = true;
                const newValue = await result;
                this._setValue(newValue);
            } else {
                if (!deepEqual(this._lastComputed, result)) {
                    this._lastComputed = result;
                    this._setValue(result);
                }
            }
            this._error = undefined;
        } catch (err) {
            this._handleExecutionError(err);
        }
    }

    _handleExecutionError(err) {
        console.warn(err);
        this._value = err;
        this._dependencyErrorSubject.next(err);
        this._error = err;
        this._notifyAll("error", err);
    }

    _resolveObservable(source) {
        if (this._asyncSubscription) {
            this._asyncSubscription.unsubscribe();
        }
        return new Promise((resolve, reject) => {
            let emitted = false;
            this._asyncSubscription = source.subscribe({
                next: (value) => {
                    if (value === NO_EMIT) return;
                    emitted = true;
                    try {
                        this._setValue(value);
                        this._asyncSubscription?.unsubscribe();
                        this._asyncSubscription = null;
                        resolve();
                    } catch (err) {
                        this._asyncSubscription?.unsubscribe();
                        this._asyncSubscription = null;
                        reject(err);
                    }
                },
                error: (err) => {
                    this._asyncSubscription?.unsubscribe();
                    this._asyncSubscription = null;
                    this._handleExecutionError(err);
                    reject(err);
                },
                complete: () => {
                    this._asyncSubscription?.unsubscribe();
                    this._asyncSubscription = null;
                    if (!emitted) resolve();
                }
            });
        });
    }

    setDependencies(dependencies) {
        super.setDependencies(dependencies);
        if (!this.fn) return;
        if (!this._queueInitialized) {
            this._ensureQueueSupport();
        } else {
            this._replaceDependencySubscriptions();
        }
    }

    addDependency(...args) {
        super.addDependency(...args);
        if (!this.fn) return;
        if (!this._queueInitialized) {
            this._ensureQueueSupport();
        } else {
            this._replaceDependencySubscriptions();
        }
    }

    removeDependency(...args) {
        super.removeDependency(...args);
        if (!this.fn) return;
        if (!this._queueInitialized) {
            this._ensureQueueSupport();
        } else {
            this._replaceDependencySubscriptions();
        }
    }

    updateDependencies(updater) {
        super.updateDependencies(updater);
        if (!this.fn) return;
        if (!this._queueInitialized) {
            this._ensureQueueSupport();
        } else {
            this._replaceDependencySubscriptions();
        }
    }

    complete() {
        this._queueTail = Promise.resolve();
        this._snapshotQueue = [];
        super.complete();
    }
};

const QueuedReactiveNode = withQueueing(ReactiveNode);
const QueuedShallowReactiveNode = withQueueing(ShallowReactiveNode);

export { QueuedReactiveNode, QueuedShallowReactiveNode };
