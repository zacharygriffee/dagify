import {BridgeNode} from "./BridgeNode.js";

/**
 * Creates a new bridge node that connects an input node to an output node.
 *
 * The BridgeNode forwards updates from the input node to the output node,
 * and its value reflects the processed output of the output node.
 * If an error occurs in the output node, the BridgeNode fails silently on the main channel.
 *
 * @param {ReactiveNode} input - The input node where updates are fed.
 * @param {ReactiveNode} output - The output node whose computed value is exposed.
 * @param {Object} [config={}] - Optional configuration options.
 * @returns {BridgeNode} A new BridgeNode instance.
 */
const createBridgeNode = (input, output, config = {}) =>
    new BridgeNode(input, output, config);


export { createBridgeNode };