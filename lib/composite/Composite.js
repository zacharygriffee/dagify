import { Subject, Observable } from "../rxjs/rxjsPrebuilt.js";
import { deepEqual } from "../util/deepEqual.js";
import * as z32 from "../util/z32.js";
import {NO_EMIT} from "../node/index.js";
import { currentKeyGenerator } from "../node/key-management/index.js";
import {diffOperator} from "../operators/index.js";

/**
 * Composite is a collection of ReactiveNodes that emits a composite value
 * whenever any of them change. When constructed with an array, its value is
 * an array of node values. When constructed with an object (mapping keys to
 * nodes), its value is an object with the same keys and corresponding node values.
 *
 * Composite instances implement key parts of the ReactiveNode interface so that
 * they can be used as dependencies in computed nodes.
 */
class Composite extends Subject {

    /**
     * Creates a new Composite instance.
     * @param {Array<ReactiveNode>|Object<string, ReactiveNode>} nodes - The reactive nodes to track.
     * @param config
     */
    constructor(nodes = [], config = {}) {
        super();

        // Mark as computed since its value is derived from children nodes.
        this._isComputed = true;

        // Determine if nodes is an array or an object.
        if (Array.isArray(nodes)) {
            this._nodesType = "array";
            // For an array, store nodes in a Set.
            this.nodes = new Set(nodes);
            // _latestValues will be a Map keyed by the node itself.
            this._latestValues = new Map();
        } else if (nodes !== null && typeof nodes === "object") {
            this._nodesType = "object";
            // For an object, store nodes in a Map keyed by the object’s keys.
            this.nodes = new Map();
            this._latestValues = {};
            for (let key in nodes) {
                if (Object.prototype.hasOwnProperty.call(nodes, key)) {
                    this.nodes.set(key, nodes[key]);
                }
            }
        } else {
            throw new Error("Invalid type for nodes. Must be an array or an object.");
        }

        this._subscriptions = new Map();

        // Determine if any node is asynchronous.
        if (this._nodesType === "array") {
            this._isAsync = Array.from(this.nodes).some(node => node.isAsync);
        } else {
            this._isAsync = false;
            this.nodes.forEach((node) => {
                if (node.isAsync) {
                    this._isAsync = true;
                }
            });
        }

        this._ready = false; // Prevent premature emissions
        this._pendingChanges = [];
        this._lastEmittedComposite = null; // Track last composite value for duplicate check

        this._key = config.key || currentKeyGenerator(this);

        this._initialize();
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
     * Indicates that this composite is a Dagify node.
     * @returns {boolean}
     */
    get isDagifyNode() {
        return true;
    }

    /**
     * Indicates that this composite is computed (its value is derived from its children).
     * @returns {boolean}
     */
    get isComputed() {
        return this._isComputed;
    }

    get isComposite() {
        return true;
    }

    /**
     * Gets the current composite value as an array (if nodes were provided as an array)
     * or as an object (if nodes were provided as an object).
     * @returns {Array<*>|Object<string, *>}
     */
    get value() {
        if (this._nodesType === "array") {
            // For arrays, build an array from the Set using _latestValues.
            return Array.from(this.nodes).map(node => this._latestValues.get(node));
        } else {
            // For objects, return a shallow copy of the _latestValues object.
            return { ...this._latestValues };
        }
    }

    /**
     * Checks if any child node is asynchronous.
     * @returns {boolean}
     */
    get isAsync() {
        return this._isAsync;
    }

    /**
     * Initializes the composite and ensures correct initial state.
     * @private
     */
    _initialize() {
        if (this._nodesType === "array") {
            this.nodes.forEach(node => {
                const value = node.value;
                this._latestValues.set(node, value === undefined || value === null ? NO_EMIT : value);
            });
            this.nodes.forEach(node => {
                if (!this._subscriptions.has(node)) {
                    const subscription = node.subscribe(value => {
                        this._latestValues.set(node, value);
                        this._emit();
                    });
                    this._subscriptions.set(node, subscription);
                }
            });
        } else {
            this.nodes.forEach((node, key) => {
                const value = node.value;
                this._latestValues[key] = value === undefined || value === null ? NO_EMIT : value;
            });
            this.nodes.forEach((node, key) => {
                if (!this._subscriptions.has(key)) {
                    const subscription = node.subscribe(value => {
                        this._latestValues[key] = value;
                        this._emit();
                    });
                    this._subscriptions.set(key, subscription);
                }
            });
        }

        queueMicrotask(() => {
            this._ready = true;
            this._emit();
            this._pendingChanges.forEach(fn => fn());
            this._pendingChanges = [];
        });
    }


    /**
     * Emits the current composite value if it has changed since the last emission,
     * or forces an emission if `force` is true.
     * @param {boolean} [force=false] - If true, bypass the duplicate check.
     * @private
     */
    _emit(force = false) {
        if (!this._ready) return;

        // Check if any dependency has NO_EMIT value
        const hasNoEmit = this._nodesType === "array"
            ? Array.from(this._latestValues.values()).some(val => val === NO_EMIT)
            : Object.values(this._latestValues).some(val => val === NO_EMIT);

        // Skip emission if any dependency has NO_EMIT
        if (hasNoEmit) {
            return;
        }

        const current = this.value;
        if (!force && this._lastEmittedComposite && deepEqual(this._lastEmittedComposite, current)) {
            return; // Skip emission if the value is deeply equal
        }
        this._lastEmittedComposite = current;
        this.next(current);
    }

    /**
     * Adds new nodes to the composite.
     * For an array-based composite, pass in a ReactiveNode or an array of ReactiveNodes.
     * For an object-based composite, pass in an object mapping keys to ReactiveNodes.
     * @param {ReactiveNode|Array<ReactiveNode>|Object<string, ReactiveNode>} nodes - The new nodes to track.
     */
    addNodes(nodes) {
        if (this._nodesType === "array") {
            if (!Array.isArray(nodes)) nodes = [nodes];

            const applyChanges = () => {
                let changed = false;
                nodes.forEach(node => {
                    if (!this.nodes.has(node)) {
                        this.nodes.add(node);
                        this._latestValues.set(node, node.value);
                        // console.log(`[Composite] Adding node ${node.id} (Value: ${node.value})`);
                        const subscription = node.subscribe(value => {
                            // console.log(`[Composite] Node ${node.id} changed → Emitting`);
                            this._latestValues.set(node, value);
                            this._emit();
                        });
                        this._subscriptions.set(node, subscription);
                        if (node.isAsync) this._isAsync = true;
                        changed = true;
                    }
                });
                if (changed) {
                    // console.log("[Composite] Nodes added, emitting new value:", this.value);
                    this._emit();
                }
            };

            if (!this._ready) {
                this._pendingChanges.push(applyChanges);
            } else {
                applyChanges();
            }
        } else {
            // Object-based composite: nodes should be an object mapping keys to ReactiveNodes.
            if (Array.isArray(nodes)) {
                throw new Error("For an object-based Composite, addNodes expects an object mapping keys to ReactiveNodes.");
            }
            const applyChanges = () => {
                let changed = false;
                for (let key in nodes) {
                    if (Object.prototype.hasOwnProperty.call(nodes, key)) {
                        const node = nodes[key];
                        if (!this.nodes.has(key)) {
                            this.nodes.set(key, node);
                            this._latestValues[key] = node.value;
                            // console.log(`[Composite] Adding node with key ${key} (Value: ${node.value})`);
                            const subscription = node.subscribe(value => {
                                // console.log(`[Composite] Node ${node.id} (key: ${key}) changed → Emitting`);
                                this._latestValues[key] = value;
                                this._emit();
                            });
                            this._subscriptions.set(key, subscription);
                            if (node.isAsync) this._isAsync = true;
                            changed = true;
                        }
                    }
                }
                if (changed) {
                    // console.log("[Composite] Nodes added, emitting new value:", this.value);
                    this._emit();
                }
            };

            if (!this._ready) {
                this._pendingChanges.push(applyChanges);
            } else {
                applyChanges();
            }
        }
    }

    /**
     * Removes nodes from the composite.
     * For an array-based composite, pass in a ReactiveNode or an array of ReactiveNodes.
     * For an object-based composite, pass in a key, an array of keys, or an object whose keys indicate which nodes to remove.
     * @param {ReactiveNode|Array<ReactiveNode>|string|Array<string>|Object} nodes - The nodes (or keys) to remove.
     */
    removeNodes(nodes) {
        if (this._nodesType === "array") {
            if (!Array.isArray(nodes)) nodes = [nodes];

            const applyChanges = () => {
                let changed = false;
                nodes.forEach(node => {
                    if (this.nodes.has(node)) {
                        // console.log(`[Composite] Removing node ${node.id}`);
                        this.nodes.delete(node);
                        this._latestValues.delete(node);
                        const subscription = this._subscriptions.get(node);
                        if (subscription) {
                            // console.log(`[Composite] Unsubscribing from node ${node.id}`);
                            subscription.unsubscribe();
                            this._subscriptions.delete(node);
                        }
                        changed = true;
                    }
                });
                this._recalculateAsyncStatus();
                if (changed) {
                    // console.log("[Composite] Nodes removed, emitting new value:", this.value);
                    this._emit();
                }
            };

            if (!this._ready) {
                this._pendingChanges.push(applyChanges);
            } else {
                applyChanges();
            }
        } else {
            // Object-based composite: allow removal by key, an array of keys, or an object whose keys indicate nodes to remove.
            let keysToRemove;
            if (typeof nodes === "string") {
                keysToRemove = [nodes];
            } else if (Array.isArray(nodes)) {
                keysToRemove = nodes;
            } else if (nodes !== null && typeof nodes === "object") {
                keysToRemove = Object.keys(nodes);
            } else {
                throw new Error("Invalid argument for removeNodes in object-based Composite.");
            }

            const applyChanges = () => {
                let changed = false;
                keysToRemove.forEach(key => {
                    if (this.nodes.has(key)) {
                        const node = this.nodes.get(key);
                        // console.log(`[Composite] Removing node with key ${key}`);
                        this.nodes.delete(key);
                        delete this._latestValues[key];
                        const subscription = this._subscriptions.get(key);
                        if (subscription) {
                            // console.log(`[Composite] Unsubscribing from node ${node.id} (key: ${key})`);
                            subscription.unsubscribe();
                            this._subscriptions.delete(key);
                        }
                        changed = true;
                    }
                });
                this._recalculateAsyncStatus();
                if (changed) {
                    // console.log("[Composite] Nodes removed, emitting new value:", this.value);
                    this._emit();
                }
            };

            if (!this._ready) {
                this._pendingChanges.push(applyChanges);
            } else {
                applyChanges();
            }
        }
    }

    /**
     * Recalculates whether the composite should be marked as asynchronous.
     * @private
     */
    _recalculateAsyncStatus() {
        if (this._nodesType === "array") {
            this._isAsync = Array.from(this.nodes).some(node => node.isAsync);
        } else {
            this._isAsync = false;
            this.nodes.forEach((node) => {
                if (node.isAsync) {
                    this._isAsync = true;
                }
            });
        }
    }

    /**
     * Converts the composite into an RxJS Observable.
     * @returns {Observable<Array<*>|Object<string, *>>}
     */
    toObservable() {
        return new Observable(subscriber => {
            subscriber.next(this.value); // Emit initial state
            const unsubscribe = this.subscribe({
                next: value => subscriber.next(value),
                error: err => subscriber.error(err),
                complete: () => subscriber.complete(),
            });
            return unsubscribe;
        });
    }

    /**
     * Completes the composite and unsubscribes from all nodes.
     */
    complete() {
        this._subscriptions.forEach(sub => sub.unsubscribe());
        this._subscriptions.clear();
        super.complete();
    }

    /**
     * Custom subscribe method that ensures proper unsubscription handling.
     * @param {Object|Function} observer - An observer or callback function.
     * @returns {Function} The unsubscribe function.
     */
    subscribe(observer) {
        if (typeof observer === "function") {
            observer = { next: observer };
        }
        const subscription = super.subscribe(observer);
        const unsubscribe = () => {
            subscription.unsubscribe();
        };
        unsubscribe.unsubscribe = unsubscribe;
        return unsubscribe;
    }

    /**
     * Forces an emission of the current composite value, bypassing the duplicate check.
     */
    update() {
        this._emit(true);
    }

    /**
     * Updates the composite’s underlying child nodes with the new value.
     *
     * In array mode:
     *   - If newValue is an array:
     *       * If its length is less than or equal to the number of child nodes,
     *         each child node is updated with the corresponding element in the array;
     *         any extra nodes remain unchanged.
     *       * If its length is greater than the number of child nodes,
     *         extra values are ignored.
     *   - Otherwise, every child node is updated with the same newValue.
     *
     * In object mode:
     *   - newValue must be an object whose keys correspond to child nodes.
     *
     * Note that the composite’s value is computed from its children, so when they update,
     * the composite’s subscriptions (set up during initialization) will trigger a new emission.
     *
     * @param {*} newValue - The new value to set.
     */
    set(newValue) {
        if (this._nodesType === "array") {
            const nodesArr = Array.from(this.nodes);
            if (Array.isArray(newValue)) {
                // Update only nodes that have a corresponding newValue value.
                nodesArr.forEach((node, i) => {
                    if (i < newValue.length && typeof node.set === "function") {
                        node.set(newValue[i]);
                    }
                });
            } else {
                nodesArr.forEach(node => {
                    if (typeof node.set === "function") node.set(newValue);
                });
            }
        } else {
            // Object mode: newValue should be an object with keys matching the composite's nodes.
            for (let key in newValue) {
                if (this.nodes.has(key)) {
                    const node = this.nodes.get(key);
                    if (typeof node.set === "function") node.set(newValue[key]);
                }
            }
        }
        // No need to explicitly call update() here:
        // each child node should trigger its own update, which in turn updates this composite.
    }

    /**
     * Returns an observable that emits diff objects based on successive array emissions.
     *
     * If the composite node's type is not "array", an error is thrown.
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
        if (this._nodesType !== "array") {
            throw new Error("diff Only supports array mode composite for now");
        }
        return this.pipe(diffOperator());
    }

}

export { Composite };
