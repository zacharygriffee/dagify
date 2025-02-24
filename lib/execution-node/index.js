import {ExecutionNode} from "./ExecutionNode.js";

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


export { createExecutionNode}