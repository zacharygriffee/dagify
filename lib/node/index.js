import {ShallowReactiveNode} from "./ShallowReactiveNode.js";
import {ReactiveNode} from "./ReactiveNode.js";
import {ExecutionNode} from "./ExecutionNode.js";


/**
 * Creates a new reactive node.
 *
 * @param {function|any} fnOrValue - A function (for computed nodes) or an initial value.
 * @param {ReactiveNode[]} [dependencies=[]] - The dependencies for computed nodes.
 * @returns {ReactiveNode} A new reactive node.
 */
const createNode = (fnOrValue, dependencies = []) => new ReactiveNode(fnOrValue, dependencies);

/**
 * Creates a new shallow reactive node that only emits updates
 * when shallow changes to its value are detected.
 *
 * This function wraps the instantiation of a ShallowReactiveNode,
 * which uses shallow equality checks (instead of deep equality) to
 * determine if the value has changed.
 *
 * @param {Function|*} fnOrValue - A function to compute the node's value or a static value.
 *                                  If a function is provided, it will be used to compute
 *                                  the node's value based on its dependencies.
 * @param {Array|*} [dependencies=[]] - An array (or a single dependency) of dependencies.
 *                                      Dependencies can be other nodes, observables,
 *                                      or values that the computed function depends on.
 *
 * @returns {ShallowReactiveNode} A new instance of ShallowReactiveNode.
 */
const createShallowNode = (fnOrValue, dependencies = []) => new ShallowReactiveNode(fnOrValue, dependencies);

/**
 * Creates a new ExecutionNode instance.
 *
 * This factory function instantiates an ExecutionNode that only emits values when explicitly triggered.
 * For computed nodes, the node's value is derived from the provided function and dependencies,
 * and will only recompute and emit upon a manual trigger (or via an external execution stream).
 * For static nodes, the provided value is used and will only be emitted when triggered.
 *
 * @param {Function|*} fnOrValue - For computed nodes, a function that derives the node's value from its dependencies;
 *                                 for static nodes, the initial value.
 * @param {Array|Object} [dependencies=[]] - Optional dependencies for computed nodes. Can be an array for positional
 *                                           dependencies or an object for named dependencies. Ignored for static nodes.
 * @param {Subject} [executionStream] - Optional RxJS Subject that controls triggering of the node. If not provided,
 *                                      a new Subject is created internally.
 * @returns {ExecutionNode} A new ExecutionNode instance.
 */
const createExecutionNode = (fnOrValue, dependencies = [], executionStream) =>
    new ExecutionNode(fnOrValue, dependencies, executionStream);

/**
 * Executes multiple updates in batch mode to optimize performance.
 *
 * @param {function} fn - A function containing multiple updates.
 */
const batch = (fn) => ReactiveNode.batch(fn);

export { nodeFactory } from "./nodeFactory.js";
export { isDagifyNode } from "./isDagifyNode.js";
export { createNode, createShallowNode, batch }