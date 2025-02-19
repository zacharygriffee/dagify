import { ReactiveNode } from "./ReactiveNode.js";
import { ShallowReactiveNode } from "./ShallowReactiveNode.js";
import { ExecutionNode } from "./ExecutionNode.js";
import { BridgeNode } from "./BridgeNode.js";

/**
 * Creates a new reactive node.
 *
 * @param {Function|any} fnOrValue - A function (for computed nodes) or an initial value.
 * @param {ReactiveNode[]|any[]} [dependencies=[]] - The dependencies for computed nodes.
 * @param {Object} [config] - Optional configuration options.
 * @returns {ReactiveNode} A new reactive node instance.
 */
const createNode = (fnOrValue, dependencies = [], config) =>
    new ReactiveNode(fnOrValue, dependencies, config);

/**
 * Creates a new shallow reactive node that only emits updates
 * when shallow changes to its value are detected.
 *
 * This function instantiates a ShallowReactiveNode, which uses shallow equality
 * checks (instead of deep equality) to determine if the value has changed.
 *
 * @param {Function|any} fnOrValue - A function to compute the node's value or a static value.
 *                                   If a function is provided, it will compute the node's value based on its dependencies.
 * @param {Array|any} [dependencies=[]] - An array (or a single dependency) of dependencies.
 *                                        Dependencies can be other nodes, observables, or values.
 * @param {Object} [config] - Optional configuration options.
 * @returns {ShallowReactiveNode} A new ShallowReactiveNode instance.
 */
const createShallowNode = (fnOrValue, dependencies = [], config) =>
    new ShallowReactiveNode(fnOrValue, dependencies, config);

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

/**
 * Creates a new ExecutionNode instance.
 *
 * This factory function instantiates an ExecutionNode that only emits values when explicitly triggered.
 * For computed nodes, the node's value is derived from the provided function and dependencies,
 * and will only recompute and emit upon a manual trigger (or via an external execution stream).
 * For static nodes, the provided value is used and will only be emitted when triggered.
 *
 * @param {Function|any} fnOrValue - For computed nodes, a function that derives the node's value from its dependencies;
 *                                   for static nodes, the initial value.
 * @param {Array|Object} [dependencies=[]] - Optional dependencies for computed nodes. Can be an array (positional mode)
 *                                           or an object (named mode). Ignored for static nodes.
 * @param {Subject} [executionStream] - Optional RxJS Subject that controls triggering of the node.
 *                                      If not provided, a new Subject is created internally.
 * @param {Object} [config] - Optional configuration options.
 * @returns {ExecutionNode} A new ExecutionNode instance.
 */
const createExecutionNode = (fnOrValue, dependencies = [], executionStream, config) =>
    new ExecutionNode(fnOrValue, dependencies, executionStream, config);

/**
 * Executes multiple updates in batch mode to optimize performance.
 *
 * @param {Function} fn - A function containing multiple updates.
 */
const batch = (fn) => ReactiveNode.batch(fn);

export { createNode, createShallowNode, batch, createBridgeNode };
export { nodeFactory } from "./nodeFactory.js";
export { isDagifyNode } from "./isDagifyNode.js";
