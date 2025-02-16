import {ShallowReactiveNode} from "./ShallowReactiveNode.js";
import {ReactiveNode} from "./ReactiveNode.js";


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
 * Executes multiple updates in batch mode to optimize performance.
 *
 * @param {function} fn - A function containing multiple updates.
 */
const batch = (fn) => ReactiveNode.batch(fn);

export { nodeFactory } from "./nodeFactory.js";
export { isDagifyNode } from "./isDagifyNode.js";
export { createNode, createShallowNode, batch }