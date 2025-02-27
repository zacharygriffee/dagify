import {ReactiveNode} from "./ReactiveNode.js";
import {dispatcher} from "../dispatcher/index.js";
import {Observable} from "../rxjs/rxjsPrebuilt.js";
import {ShallowReactiveNode} from "../shallow-node/ShallowReactiveNode.js";
import {isPlainObject} from "../util/IsPlainObject.js";

/**
 * Creates a new reactive node.
 *
 * @param {Function|any} fnOrValue - A function (for computed nodes) or an initial value.
 * @param {(ReactiveNode | Composite | Function | Promise | Observable) |
 *         (ReactiveNode | Composite | Function | Promise | Observable)[] |
 *         { [key: string]: ReactiveNode | Composite | Function | Promise | Observable }} [dependencies=[]] - The dependencies for computed nodes.
 * @param {Object} [config] - Optional configuration options.
 * @param {boolean} [config.disableBatching=false] - If true, bypasses batching for updates.
 * @param {Buffer} [config.key] - A 32-byte buffer used as the node's key.
 * @param {function} [config.onCleanup] - A callback function that is invoked when the last subscriber unsubscribes, allowing for cleanup.
 * @param {boolean} [config.shallow=false] - Whether this node reacts shallowly.
 * @param {boolean} [config.terminal=false] - Whether this node is a sink node and cannot be a dependency to other nodes.
 * @returns {ReactiveNode} A new reactive node instance.
 */
const createNode = (fnOrValue, dependencies = [], config) => {
    let shallow = false;
    if (typeof fnOrValue === "function") {
        shallow = config && config.shallow === true;
    } else if (isPlainObject(dependencies)) {
        shallow = dependencies.shallow === true;
    }

    if (shallow) {
        return new ShallowReactiveNode(fnOrValue, dependencies, config);
    } else {
        return new ReactiveNode(fnOrValue, dependencies, config);
    }
};

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
export {identity} from "./identity.js";
export {ensureNode} from "./ensureNode.js";
export * from "./key-management/index.js";


