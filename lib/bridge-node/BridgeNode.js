import { ReactiveNode } from '../node/ReactiveNode.js';
import {NO_EMIT} from "../node/NO_EMIT.js";

/**
 * BridgeNode is a thin wrapper that connects an input node to an output node.
 * - The input node is where values are fed (via set).
 * - The output node is the node whose computed (processed) value is exposed by the BridgeNode.
 *
 * When a new value is set on the BridgeNode, it forwards that value to the input node.
 * The BridgeNode’s internal value is kept in sync with the output node’s value.
 * If the output node encounters an error during recomputation, the BridgeNode simply fails silently
 * (i.e. it does not notify its subscribers of the error).
 */
class BridgeNode extends ReactiveNode {
    /**
     * Creates a new BridgeNode.
     *
     * @param {ReactiveNode} inputNode - The node where updates are fed.
     * @param {ReactiveNode} outputNode - The node that produces the final (processed) value.
     * @param {Object} [config] - Optional configuration.
     */
    constructor(inputNode, outputNode, config = {}) {
        // Call the parent constructor with a static initial value (null).
        config.skip = 1;
        super(NO_EMIT, null, config);
        this.inputNode = inputNode;
        this.outputNode = outputNode;

        // Initially update our internal value from the output node.
        this._setValue(this.outputNode.value, true);

        // Subscribe to the output node so that when it emits a new value,
        // we update our internal value.
        this._outputSubscription = this.outputNode.subscribe({
            next: (val) => {
                // Simply update our value with the latest value from the output node.
                this._setValue(val, true);
            },
            // Fail silently: do not propagate errors on the main channel.
            error: (err) => { /* ignore errors */ },
            complete: () => this.complete()
        });
    }

    /**
     * Forwards a new value to the input node.
     * After setting, it forces the output node to recompute.
     * Regardless of whether an error occurs, the BridgeNode updates its internal value
     * from the output node and does not propagate errors.
     *
     * @param {*} newValue - The new value to set.
     * @returns {Promise<void>} A promise that resolves on the next tick.
     */
    set(newValue) {
        // Forward the new value to the input node.
        this.inputNode.set(newValue);
        // In a microtask, force the output node to recompute.
        queueMicrotask(() => {
            this.outputNode.compute();
            // Regardless of any error, update our value from the output node.
            this._setValue(this.outputNode.value, true);
        });
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    /**
     * Completes the BridgeNode and cleans up its subscription.
     */
    complete() {
        if (this._outputSubscription) {
            this._outputSubscription.unsubscribe();
            this._outputSubscription = null;
        }
        super.complete();
    }
}

export { BridgeNode };
