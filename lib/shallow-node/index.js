import {ShallowReactiveNode} from "./ShallowReactiveNode.js";

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

export { createShallowNode}