import "./key-management/defaultKeyGenerator.js";
import {ReactiveNode} from "./ReactiveNode.js";
import {dispatcher} from "../dispatcher/index.js";
import {Observable} from "../rxjs/rxjsPrebuilt.js";

/**
 * Creates a new reactive node.
 *
 * @param {Function|any} fnOrValue - A function (for computed nodes) or an initial value.
 * @param {(ReactiveNode | Composite | Function | Promise | Observable) |
 *         (ReactiveNode | Composite | Function | Promise | Observable)[] |
 *         { [key: string]: ReactiveNode | Composite | Function | Promise | Observable }} [dependencies=[]] - The dependencies for computed nodes.* @param {Object} [config] - Optional configuration options.
 * @param {Object} [config] - (Optional) Configuration options.
 * @param {boolean} [config.disableBatching=false] - If true, bypasses batching for updates.
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
export * from "./key-management/index.js";


