import "../crypto/keyGenerator.js";
import {ReactiveNode} from "./ReactiveNode.js";
import {dispatcher} from "../dispatcher/index.js";

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
 * Executes multiple updates in batch mode to optimize performance.
 *
 * @param {Function} fn - A function containing multiple updates.
 */
const batch = (fn) => ReactiveNode.batch(fn);

export {NO_EMIT} from "./NO_EMIT.js";
export {createNode, batch, dispatcher};
export {nodeFactory} from "./nodeFactory.js";
export {isDagifyNode} from "./isDagifyNode.js";


