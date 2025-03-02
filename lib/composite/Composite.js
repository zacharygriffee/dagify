import { ReactiveNode } from "../node/ReactiveNode.js";
import { deepEqual } from "../util/deepEqual.js";
import { NO_EMIT } from "../node/index.js";

/**
 * Composite is a subclass of ReactiveNode.
 *
 * When disableBatching is false (the default), Composite uses an aggregated,
 * asynchronous approach for performance. When disableBatching is true, it uses
 * per-node immediate updates (the original behavior).
 */
class Composite extends ReactiveNode {
    /**
     * Creates a new Composite instance.
     * @param {Array<ReactiveNode>|Object<string, ReactiveNode>} nodes - The reactive nodes to track.
     * @param {Object} config - Optional configuration. Defaults to disableBatching=false.
     */
    constructor(nodes = [], config = {}) {
        // Default disableBatching to false (new async behavior)
        const compositeConfig = { disableBatching: false, ...config };

        // For disableBatching mode, create a local dummy holder so we don't reference `this` before super.
        let dummyValueHolder;
        if (compositeConfig.disableBatching) {
            dummyValueHolder = { value: undefined };
        }

        // When disableBatching is true, use a compute function that returns the dummy's value.
        // Otherwise, compute an aggregated value from the nodes.
        const computeFn = compositeConfig.disableBatching
            ? () => dummyValueHolder.value
            : () => {
                if (Array.isArray(nodes)) {
                    const values = nodes.map(node => node.value);
                    return values.some(val => val === NO_EMIT) ? NO_EMIT : values;
                } else if (nodes && typeof nodes === "object") {
                    const composite = {};
                    for (let key in nodes) {
                        if (Object.prototype.hasOwnProperty.call(nodes, key)) {
                            composite[key] = nodes[key].value;
                        }
                    }
                    return Object.values(composite).some(val => val === NO_EMIT)
                        ? NO_EMIT
                        : composite;
                }
                throw new Error("Invalid type for nodes. Must be an array or an object.");
            };

        // Pass dependencies only in aggregated mode.
        const dependencies = compositeConfig.disableBatching ? [] : nodes;

        // Call super with the compute function, dependencies, and our configuration.
        super(computeFn, dependencies, compositeConfig);

        // Now assign our config to an instance property.
        this.config = compositeConfig;

        // Set up mode and internal caches.
        if (Array.isArray(nodes)) {
            this._nodesType = "array";
            this.nodes = nodes.slice();
            this._isAsync = nodes.some(node => node.isAsync);
            if (this.config.disableBatching) {
                this._latestValues = new Map();
                this.nodes.forEach(node => this._latestValues.set(node, node.value));
            }
        } else if (nodes !== null && typeof nodes === "object") {
            this._nodesType = "object";
            this.nodes = { ...nodes };
            this._isAsync = Object.values(this.nodes).some(node => node.isAsync);
            if (this.config.disableBatching) {
                this._latestValues = {};
                Object.keys(this.nodes).forEach(key => {
                    this._latestValues[key] = this.nodes[key].value;
                });
            }
        } else {
            throw new Error("Invalid type for nodes. Must be an array or an object.");
        }

        // In disableBatching mode, store the dummy holder for later updates.
        if (this.config.disableBatching) {
            this._dummyValueHolder = dummyValueHolder;
            this._subscriptions = [];
            this._setupImmediateSubscriptions();
            this._updateComposite();
        }
    }

    /**
     * For disableBatching true: subscribe to each node individually so that each update
     * immediately updates our cache and composite value.
     */
    _setupImmediateSubscriptions() {
        if (this._subscriptions) {
            this._subscriptions.forEach(unsub => unsub());
        }
        this._subscriptions = [];
        if (this._nodesType === "array") {
            this.nodes.forEach(node => {
                const unsub = node.subscribe(value => {
                    this._latestValues.set(node, value);
                    this._updateComposite();
                });
                this._subscriptions.push(unsub);
            });
        } else {
            Object.keys(this.nodes).forEach(key => {
                const node = this.nodes[key];
                const unsub = node.subscribe(value => {
                    this._latestValues[key] = value;
                    this._updateComposite();
                });
                this._subscriptions.push(unsub);
            });
        }
    }

    /**
     * Aggregates the current values from the cache (used only when disableBatching is true).
     */
    _aggregateValue() {
        if (this._nodesType === "array") {
            const values = this.nodes.map(node => this._latestValues.get(node));
            return values.some(val => val === NO_EMIT) ? NO_EMIT : values;
        } else {
            const composite = {};
            for (let key in this.nodes) {
                composite[key] = this._latestValues[key];
            }
            return Object.values(composite).some(val => val === NO_EMIT)
                ? NO_EMIT
                : composite;
        }
    }

    /**
     * For disableBatching true, updates the composite value and notifies subscribers if changed.
     */
    _updateComposite() {
        const newValue = this._aggregateValue();
        // Here we force an emission if update() is called, even if deepEqual would block it.
        if (!deepEqual(this._dummyValueHolder.value, newValue)) {
            this._dummyValueHolder.value = newValue;
            this._setValue(newValue);
        }
    }

    /**
     * Override update() to force an emission even if the computed value hasn't changed.
     */
    update() {
        if (this.config.disableBatching) {
            // Force emission by calling _setValue with forceEmit flag.
            const newValue = this._aggregateValue();
            this._setValue(newValue, true);
        } else {
            super.update();
        }
    }

    /**
     * Override set() to delegate to child nodes.
     *
     * In array mode:
     *  - If newValue is an array, update each child node at matching indexes.
     *  - If newValue is not an array, update all child nodes.
     *
     * In object mode:
     *  - newValue is expected to be an object whose keys map to child nodes.
     */
    set(newValue) {
        if (this._nodesType === "array") {
            if (Array.isArray(newValue)) {
                this.nodes.forEach((node, i) => {
                    if (i < newValue.length && typeof node.set === "function") {
                        node.set(newValue[i]);
                    }
                });
            } else {
                this.nodes.forEach(node => {
                    if (typeof node.set === "function") {
                        node.set(newValue);
                    }
                });
            }
        } else {
            if (typeof newValue !== "object" || Array.isArray(newValue)) {
                throw new Error("Composite set in object mode expects an object");
            }
            Object.keys(newValue).forEach(key => {
                if (this.nodes.hasOwnProperty(key)) {
                    const node = this.nodes[key];
                    if (typeof node.set === "function") {
                        node.set(newValue[key]);
                    }
                }
            });
        }
        // No need to call super.set; child nodes will trigger composite recomputation.
    }

    /**
     * addNodes and removeNodes should update subscriptions accordingly.
     */
    addNodes(newNodes) {
        if (this._nodesType === "array") {
            if (!Array.isArray(newNodes)) newNodes = [newNodes];
            newNodes.forEach(node => {
                if (!this.nodes.includes(node)) {
                    this.nodes.push(node);
                    if (this.config.disableBatching) {
                        this._latestValues.set(node, node.value);
                    }
                }
            });
        } else {
            if (Array.isArray(newNodes)) {
                throw new Error(
                    "For object mode, addNodes expects an object mapping keys to ReactiveNodes."
                );
            }
            Object.assign(this.nodes, newNodes);
            if (this.config.disableBatching) {
                Object.keys(newNodes).forEach(key => {
                    this._latestValues[key] = newNodes[key].value;
                });
            }
        }
        if (this.config.disableBatching) {
            this._setupImmediateSubscriptions();
            this._updateComposite();
        } else {
            this.setDependencies(this.nodes);
            this.compute();
        }
    }

    removeNodes(nodesToRemove) {
        if (this._nodesType === "array") {
            if (!Array.isArray(nodesToRemove)) nodesToRemove = [nodesToRemove];
            this.nodes = this.nodes.filter(node => !nodesToRemove.includes(node));
            if (this.config.disableBatching) {
                nodesToRemove.forEach(node => this._latestValues.delete(node));
            }
        } else {
            let keysToRemove = [];
            if (typeof nodesToRemove === "string") {
                keysToRemove.push(nodesToRemove);
            } else if (Array.isArray(nodesToRemove)) {
                keysToRemove = nodesToRemove;
            } else if (nodesToRemove !== null && typeof nodesToRemove === "object") {
                keysToRemove = Object.keys(nodesToRemove);
            } else {
                throw new Error("Invalid argument for removeNodes in object mode.");
            }
            keysToRemove.forEach(key => {
                delete this.nodes[key];
                if (this.config.disableBatching) {
                    delete this._latestValues[key];
                }
            });
        }
        if (this.config.disableBatching) {
            this._setupImmediateSubscriptions();
            this._updateComposite();
        } else {
            this.setDependencies(this.nodes);
            this.compute();
        }
    }

    complete() {
        if (this.config.disableBatching && this._subscriptions) {
            this._subscriptions.forEach(unsub => unsub());
            this._subscriptions = [];
        }
        super.complete();
    }

    get diff() {
        return super.diff;
    }
}

export { Composite };
