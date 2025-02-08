import { Subject, Observable } from "./rxjs/rxjsPrebuilt.js";
// Assume you have a deepEqual function imported or defined elsewhere:
import { deepEqual } from "./util/deepEqual.js";

/**
 * Composite is a collection of ReactiveNodes that emits a composite value
 * whenever any of them change. When constructed with an array, its value is
 * an array of node values. When constructed with an object (mapping keys to
 * nodes), its value is an object with the same keys and corresponding node values.
 */
class Composite extends Subject {
    /**
     * Creates a new Composite instance.
     * @param {Array<ReactiveNode>|Object<string, ReactiveNode>} nodes - The reactive nodes to track.
     */
    constructor(nodes = []) {
        super();
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

        this._initialize();
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
            // Capture initial values for array-based nodes.
            this.nodes.forEach(node => {
                this._latestValues.set(node, node.value);
            });

            // Subscribe to all nodes.
            this.nodes.forEach(node => {
                if (!this._subscriptions.has(node)) {
                    const subscription = node.subscribe(value => {
                        console.log(`[Composite] Node ${node.id} changed → Emitting`);
                        this._latestValues.set(node, value);
                        this._emit();
                    });
                    this._subscriptions.set(node, subscription);
                }
            });
        } else {
            // Capture initial values for object-based nodes.
            this.nodes.forEach((node, key) => {
                this._latestValues[key] = node.value;
            });

            // Subscribe to all nodes.
            this.nodes.forEach((node, key) => {
                if (!this._subscriptions.has(key)) {
                    const subscription = node.subscribe(value => {
                        console.log(`[Composite] Node ${node.id} (key: ${key}) changed → Emitting`);
                        this._latestValues[key] = value;
                        this._emit();
                    });
                    this._subscriptions.set(key, subscription);
                }
            });
        }

        // Set _ready after subscriptions are established.
        queueMicrotask(() => {
            this._ready = true;
            console.log("[Composite] Ready, emitting initial value:", this.value);
            this._emit();
            // Process any pending changes.
            this._pendingChanges.forEach(fn => fn());
            this._pendingChanges = [];
        });
    }

    /**
     * Emits the current composite value if it has changed since the last emission.
     * @private
     */
    _emit() {
        if (!this._ready) return;
        const current = this.value;
        // Only emit if the current composite value is different (deep comparison).
        if (this._lastEmittedComposite && deepEqual(this._lastEmittedComposite, current)) {
            console.log("[Composite] Skipped duplicate emission:", current);
            return;
        }
        this._lastEmittedComposite = current;
        console.log("[Composite] Emitting:", current);
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
                        console.log(`[Composite] Adding node ${node.id} (Value: ${node.value})`);
                        const subscription = node.subscribe(value => {
                            console.log(`[Composite] Node ${node.id} changed → Emitting`);
                            this._latestValues.set(node, value);
                            this._emit();
                        });
                        this._subscriptions.set(node, subscription);
                        if (node.isAsync) this._isAsync = true;
                        changed = true;
                    }
                });
                if (changed) {
                    console.log("[Composite] Nodes added, emitting new value:", this.value);
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
                            console.log(`[Composite] Adding node with key ${key} (Value: ${node.value})`);
                            const subscription = node.subscribe(value => {
                                console.log(`[Composite] Node ${node.id} (key: ${key}) changed → Emitting`);
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
                    console.log("[Composite] Nodes added, emitting new value:", this.value);
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
                        console.log(`[Composite] Removing node ${node.id}`);
                        this.nodes.delete(node);
                        this._latestValues.delete(node);
                        const subscription = this._subscriptions.get(node);
                        if (subscription) {
                            console.log(`[Composite] Unsubscribing from node ${node.id}`);
                            subscription.unsubscribe();
                            this._subscriptions.delete(node);
                        }
                        changed = true;
                    }
                });
                this._recalculateAsyncStatus();
                if (changed) {
                    console.log("[Composite] Nodes removed, emitting new value:", this.value);
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
                        console.log(`[Composite] Removing node with key ${key}`);
                        this.nodes.delete(key);
                        delete this._latestValues[key];
                        const subscription = this._subscriptions.get(key);
                        if (subscription) {
                            console.log(`[Composite] Unsubscribing from node ${node.id} (key: ${key})`);
                            subscription.unsubscribe();
                            this._subscriptions.delete(key);
                        }
                        changed = true;
                    }
                });
                this._recalculateAsyncStatus();
                if (changed) {
                    console.log("[Composite] Nodes removed, emitting new value:", this.value);
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
     */
    subscribe(observer) {
        if (typeof observer === 'function') {
            observer = { next: observer };
        }
        const subscription = super.subscribe(observer);
        const unsubscribe = () => {
            subscription.unsubscribe();
        };
        return unsubscribe.unsubscribe = unsubscribe;
    }
}

export { Composite };
