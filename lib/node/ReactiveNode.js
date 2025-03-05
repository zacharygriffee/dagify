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
 *
 * @remarks
 * When the activity thresholding mechanism is enabled (via {@link config.enableActivityThresholding}),
 * the node will accumulate "visits" in the {@link activityLevel} property and only trigger a compute
 * once the {@link activationThreshold} is reached. A decay timer (with interval {@link decayInterval})
 * automatically reduces the {@link activityLevel} over time when the node is not visited.
 *
 * **Important:** Nodes with activity thresholding spawn an internal decay timer that must be cleaned up
 * by calling the node's {@link complete} method (or equivalent) when the node is no longer needed.
 *
 * @example
 * // Create a computed node that uses activity thresholding:
 * const sensorNode = createNode(
 *   () => expensiveComputation(),
 *   [dep1, dep2],
 *   {
 *     enableActivityThresholding: true, // Enable update aggregation
 *     activationThreshold: 3,           // Compute after 3 visits
 *     decayInterval: 1000               // Decay timer interval (ms)
 *   }
 * );
 *
 * // Simulate frequent updates:
 * setInterval(() => sensorNode.visit(), 300);
 *
 * // Later, when done:
 * sensorNode.complete(); // Clears internal timers, preventing resource leaks
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
     *         { [key: string]: ReactiveNode | Composite | Function | Promise | Observable }} [dependencies=[]]
     *         The dependencies for computed nodes.
     * @param {Object} [config] - (Optional) Configuration options.
     * @param {boolean} [config.disableBatching=false] - If true, bypasses batching for updates.
     * @param {Buffer} [config.key] - A 32-byte buffer used as the node's key.
     * @param {function} [config.finalize] - A callback invoked when the node is finalized (on complete or error).
     * @param {function} [config.onCleanup] - (Deprecated) Same as finalize.
     * @param {function} [config.onSubscribe] - A callback invoked on every new subscription (receives the new subscriber count).
     * @param {function} [config.onUnsubscribe] - A callback invoked on every unsubscription (receives the new subscriber count).
     *
     * @param {boolean} [config.enableActivityThresholding=false] - If true, enables the activity thresholding mechanism.
     * When enabled, the node will:
     *   - Accumulate update "visits" in {@link activityLevel}.
     *   - Trigger compute only when {@link activityLevel} reaches {@link activationThreshold}.
     *   - Automatically decrement the {@link activityLevel} over time using an internal decay timer.
     * @param {number} [config.activationThreshold=5] - The number of visits required to trigger a compute.
     * @param {number} [config.decayInterval=1000] - The time interval (in milliseconds) for decaying the activity level.
     * @param {string|function} [config.type="any"] - The type checker for the node. Either the name registered under the global types, or a custom validator function.
     * @param {string} [config.valueEncoding="any"] - The encoding for the value when calling 'encodeForSink' to get a buffer for serialization. If the node gets a buffer as a
     * value then this encoding will attempt to decode that value, and then type check with {@link type}. Read the docs section for more information on how to construct an
     * encoding string.
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

        // --- Activity Thresholding Configuration ---
        // When enabled, the node aggregates "visits" before computing.
        this.enableActivityThresholding = config.enableActivityThresholding ?? false;
        if (this.enableActivityThresholding) {
            /** @type {number} The accumulated number of visits since the last compute. */
            this.activityLevel = 0;
            /** @type {number} The number of visits required to trigger compute. */
            this.activationThreshold = config.activationThreshold ?? 5;
            /** @type {number} The interval in milliseconds at which the activity level decays. */
            this.decayInterval = config.decayInterval ?? 1000;
            /** @type {number} The timestamp of the last visit. */
            this.lastVisited = Date.now();
            // Store the timer handle so that it can be cleaned up.
            this._decayTimer = this.startDecay();
        }
        // --- End Activity Thresholding Configuration ---

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

    /**
     * Returns an observable stream for dependency errors.
     *
     * @returns {Observable} Observable stream emitting dependency errors.
     */
    get dependencyError$() {
        return this._dependencyErrorSubject.asObservable();
    }

    /**
     * Indicates that this is a Dagify node.
     *
     * @returns {boolean} Always true.
     */
    get isDagifyNode() {
        return true;
    }

    /**
     * Indicates whether the node is a sink (terminal node).
     *
     * @returns {boolean} True if the node is a sink, false otherwise.
     */
    get isSink() {
        return this._isSink;
    }

    /**
     * Indicates whether the node updates without batching.
     *
     * @returns {boolean} True if batching is disabled, false otherwise.
     */
    get unbatched() {
        return this.disableBatching;
    }

    /**
     * Indicates whether the node handles asynchronous updates.
     *
     * @returns {boolean} True if the node is asynchronous, false otherwise.
     */
    get isAsync() {
        return !!this._isAsync;
    }

    /**
     * Indicates whether the node is computed.
     *
     * @returns {boolean} True if the node has a computation function, false otherwise.
     */
    get isComputed() {
        return !!this.fn;
    }

    /**
     * Indicates whether the node has an active value (i.e. not NO_EMIT).
     *
     * @returns {boolean} True if the node is active, false otherwise.
     */
    get isActive() {
        return this.value !== NO_EMIT;
    }

    /**
     * Returns the encoded node identifier.
     *
     * @returns {string} The encoded node ID.
     */
    get id() {
        if (!this._encodedId) {
            this._encodedId = z32.encode(this.key);
        }
        return this._encodedId;
    }

    /**
     * Gets the node's key.
     *
     * @returns {Buffer} The node's key.
     */
    get key() {
        return this._key;
    }

    /**
     * Sets the node's key.
     *
     * @param {Buffer} value - A 32-byte buffer representing the new key.
     * @throws {Error} Throws an error if the key is not a 32-byte buffer.
     */
    set key(value) {
        if (value.byteLength !== 32) throw new Error("Key must be 32 byte buffer.");
        this._key = value;
    }

    /**
     * Returns an observable that skips the first emission.
     *
     * @returns {Observable} Observable that skips the first value.
     */
    get skip() {
        return this.pipe(skip(1));
    }

    /**
     * Returns an observable that emits only once.
     *
     * @returns {Observable} Observable that emits one value and completes.
     */
    get once() {
        return this.toObservable().pipe(take(1));
    }

    /**
     * Gets the node's type.
     *
     * @returns {string} The type of the node.
     */
    get type() {
        return this._type;
    }

    /**
     * Sets the node's type.
     *
     * @param {string} value - The new type.
     */
    set type(value) {
        this._type = value;
    }

    /**
     * Gets the node's value encoding.
     *
     * @returns {string} The encoding type.
     */
    get valueEncoding() {
        return this._valueEncoding;
    }

    /**
     * Sets the node's value encoding.
     *
     * @param {string} value - The new encoding type.
     */
    set valueEncoding(value) {
        this._valueEncoding = value;
    }

    /**
     * Gets the node's metadata.
     *
     * @returns {Object} The metadata associated with the node.
     */
    get metadata() {
        return this._metadata;
    }

    /**
     * Sets the node's metadata.
     *
     * @param {Object} value - The new metadata object.
     */
    set metadata(value) {
        this._metadata = value;
    }

    /**
     * Gets the node's current value.
     * If an encoding is active (i.e. not "any"), returns the decoded value.
     * Otherwise, returns the stored raw value.
     *
     * @returns {*} The node's current value.
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
     *
     * @param {*} newValue - The new value for the node.
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

        // Validate the (possibly decoded) newValue against the node's type.
        if (!this._validateType(newValue)) {
            const typeErr = new Error(`Type mismatch: value does not conform to type "${this._type}"`);
            this.error(typeErr);
            return;
        }

        // Set the raw value.
        this._value = newValue;

        // If an encoding is set, encode the newValue for internal storage.
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

    /**
     * Returns an observable that emits the difference between successive values.
     *
     * @returns {Observable} Observable emitting diffs.
     */
    get diff() {
        return this.pipe(diffOperator());
    }

    // --- Activity Thresholding (Neuron-Inspired) Methods ---

    /**
     * Registers an update ("visit") on the node.
     *
     * When {@link enableActivityThresholding} is enabled, each call to this method:
     *   - Increments the internal {@link activityLevel}.
     *   - Updates {@link lastVisited} to the current time.
     *   - If {@link activityLevel} reaches {@link activationThreshold}, triggers a compute,
     *     then resets {@link activityLevel} to 0.
     *
     * When activity thresholding is disabled, this method immediately triggers a compute.
     */
    visit() {
        if (!this.enableActivityThresholding) {
            // Fallback: immediate compute if activity thresholding is disabled.
            this.compute();
            return;
        }
        this.activityLevel++;
        this.lastVisited = Date.now();
        if (this.activityLevel >= this.activationThreshold) {
            // Node "fires": compute and reset activity level.
            this.compute();
            this.activityLevel = 0;
        }
    }

    /**
     * Starts a decay timer that periodically reduces the {@link activityLevel}
     * when the node is not being visited.
     *
     * @returns {number|NodeJS.Timeout} The handle of the timer.
     *
     * @remarks
     * This timer runs continuously (until cleared) to ensure that sporadic visits decay over time.
     * It is important to clear this timer by calling {@link complete} when the node is no longer needed.
     */
    startDecay() {
        if (!this.enableActivityThresholding) return;
        return setInterval(() => {
            const now = Date.now();
            if (now - this.lastVisited >= this.decayInterval) {
                this.activityLevel = Math.max(0, this.activityLevel - 1);
            }
        }, this.decayInterval);
    }
    // --- End Activity Thresholding Methods ---

    /**
     * Schedules an update (either compute or visit) on the given node.
     *
     * @param {ReactiveNode} node - The node to schedule an update for.
     */
    static scheduleUpdate(node) {
        if (node.disableBatching) {
            node.useNeuronElevation ? node.visit() : node.compute();
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
                ReactiveNode.pendingUpdates.forEach(n => {
                    n.useNeuronElevation ? n.visit() : n.compute();
                });
                ReactiveNode.pendingUpdates.clear();
                ReactiveNode.updating = false;
            });
        }
    }

    /**
     * Executes the provided function in batch mode, deferring updates until completion.
     *
     * @param {Function} fn - The function to execute in batch mode.
     */
    static batch(fn) {
        ReactiveNode.batchMode = true;
        fn();
        ReactiveNode.batchMode = false;
        ReactiveNode.pendingUpdates.forEach(n => n.compute());
        ReactiveNode.pendingUpdates.clear();
    }

    /**
     * Validates that the provided value conforms to the node's type.
     *
     * @param {*} newValue - The value to validate.
     * @returns {boolean} True if valid; otherwise false.
     * @private
     */
    _validateType(newValue) {
        if (this._type === "any") return true;
        const validator = types.getType(this._type);
        if (!validator) return true;
        return validator(newValue);
    }

    /**
     * Returns the encoded node ID.
     *
     * @returns {string} The encoded node ID.
     */
    getId() {
        return z32.encode(this.key);
    }

    /**
     * Filters out dependency errors from the given dependency value.
     *
     * @param {*} depValue - The value from dependencies.
     * @param {*} normalizedDeps - The normalized dependencies.
     * @param {ReplaySubject} errorSubject - Subject to report errors.
     * @returns {Object} An object with a validity flag and possibly filtered values and normalized dependencies.
     */
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

    /**
     * Computes the node's value based on its dependencies.
     *
     * @remarks
     * If the function returns an observable or promise, asynchronous update handling is used.
     * Otherwise, the value is updated synchronously.
     */
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

    /**
     * Sets the node's value.
     *
     * For computed nodes, manually setting the value is disallowed.
     *
     * @param {*} newValue - The new value to set.
     * @returns {Promise|undefined} A promise if batching is enabled.
     * @throws {Error} Throws an error if attempting to set a computed node.
     */
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

    /**
     * Handles a new update by computing the node if computed or setting the value if static.
     *
     * @param {*} value - The new value.
     */
    next(value) {
        this.fn ? this.compute() : this.set(value);
    }

    /**
     * Subscribes an observer to the node's updates.
     *
     * @param {Object|Function} observer - An observer or next callback.
     * @returns {Function} Unsubscribe function.
     */
    subscribe(observer) {
        return this._subscribeCore(observer);
    }

    /**
     * Subscribes an observer to receive a single update.
     *
     * @param {Object|Function} observer - An observer or next callback.
     * @returns {Subscription} Subscription for the one-time update.
     */
    subscribeOnce(observer) {
        return this.toObservable().pipe(take(1)).subscribe(observer);
    }

    /**
     * Handles an error by finalizing the node and notifying subscribers.
     *
     * @param {Error} err - The error encountered.
     */
    error(err) {
        this.finalize(err);
        this._notifyAll('error', err);
    }

    /**
     * Completes the node, notifying subscribers of completion and cleaning up resources.
     *
     * @remarks
     * This method clears all subscriptions and, if activity thresholding is enabled,
     * also clears the internal decay timer to prevent the process from hanging.
     */
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
        // Clear the decay timer if it exists.
        if (this._decayTimer) {
            clearInterval(this._decayTimer);
            this._decayTimer = null;
        }
    }

    /**
     * Internal method to update the node's value and notify subscribers.
     * If newValue equals NO_EMIT, no update is made.
     * Uses the public setter so that encoding happens automatically.
     *
     * @param {*} newValue - The new value.
     * @param {boolean} [forceEmit=false] - If true, forces emission even if unchanged.
     * @private
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

    /**
     * Encodes the node's value for sink nodes.
     *
     * @returns {Buffer} The encoded value.
     * @throws {Error} Throws if the node does not have an encoding set.
     */
    encodeForSink() {
        if (!this._valueEncoding || this._valueEncoding === "any") {
            throw new Error(`Node does not have an encoding set.`);
        }
        return encodeValue(this.value, this._valueEncoding);
    }

    /**
     * Internal method to handle subscription logic.
     *
     * @param {Object|Function} observer - The observer to subscribe.
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

    /**
     * Internal helper to initialize an observer.
     *
     * @param {Object|Function} observer - The observer to initialize.
     * @returns {Object} The initialized observer.
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
     * Notifies all subscribers with the given event type.
     *
     * @param {string} type - The type of event ('next', 'error', or 'complete').
     * @param {*} [value] - The value to emit.
     * @private
     */
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

    /**
     * Unsubscribes from all dependency subscriptions.
     *
     * @private
     */
    _unsubscribeDependencies() {
        this._dependencySubscriptions?.forEach(unsubscribe => unsubscribe());
        this._dependencySubscriptions = [];
    }

    /**
     * Sets new dependencies for computed nodes and recomputes the value.
     *
     * @param {(ReactiveNode | Composite | Function | Promise | Observable) |
     *         (ReactiveNode | Composite | Function | Promise | Observable)[] |
     *         { [key: string]: ReactiveNode | Composite | Function | Promise | Observable }} dependencies - The new dependencies.
     * @throws {Error} Throws if called on a non-computed node.
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
     * Adds one or more dependencies to the node.
     *
     * @param {...*} args - The dependency or dependencies to add.
     * @throws {Error} Throws if called on a non-computed node or if a sink node is provided.
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
     * Removes one or more dependencies from the node.
     *
     * @param {...*} args - The dependency or key(s) to remove.
     * @throws {Error} Throws if called on a non-computed node or if arguments are invalid.
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
     * Lists the IDs of all dependencies.
     *
     * @returns {string[]} An array of dependency node IDs.
     */
    listDependencies() {
        const nodes = collectReactiveNodes(this.normalizedDeps);
        return nodes.map(dep => dep.id);
    }

    /**
     * Subscribes to an observable, updating the node's value with incoming values.
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
     * Converts the node into an observable.
     *
     * @returns {Observable} An observable that emits the node's values.
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
     * Updates the node.
     *
     * For computed nodes, triggers a re-computation.
     * For static nodes, updates the value either via a function or directly.
     *
     * @param {Function|*} fnOrValue - A function to compute a new value from the current one, or a new value.
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
     * Updates the node's dependencies.
     *
     * @param {Function} updateFn - A function that receives the current normalized dependencies and returns updated dependencies.
     * @throws {Error} Throws if called on a non-computed node.
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
