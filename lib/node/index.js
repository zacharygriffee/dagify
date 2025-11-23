import {ReactiveNode} from "./ReactiveNode.js";
import {dispatcher} from "../dispatcher/index.js";
import {Observable} from "rxjs";
import {ShallowReactiveNode} from "../shallow-node/ShallowReactiveNode.js";
import {ReferenceReactiveNode} from "../shallow-node/ReferenceReactiveNode.js";
import {isPlainObject} from "../util/IsPlainObject.js";
import {QueuedReactiveNode, QueuedShallowReactiveNode} from "./QueuedReactiveNode.js";
export {defaultFatalErrorPredicate, setFailFastEnabled, setFailFastPredicate} from "./failFast.js";

/**
 * Creates a new reactive node.
 *
 * @param {Function|any} fnOrValue - A function (for computed nodes) or an initial value.
 * @param {(ReactiveNode | Composite | Function | Promise | Observable) |
 *         (ReactiveNode | Composite | Function | Promise | Observable)[] |
 *         { [key: string]: ReactiveNode | Composite | Function | Promise | Observable }} [dependencies=[]] - The dependencies for computed nodes.
 * @param {Object} [config] - Optional configuration options.
 * @param {boolean} [config.disableBatching=false] - If true, bypasses batching for updates.
 * @param {Uint8Array} [config.key] - A 32-byte Uint8Array used as the node's key.
 * @param {function} [config.onCleanup] - A callback function that is invoked when the last subscriber unsubscribes, allowing for cleanup.
 * @param {boolean} [config.shallow=false] - Whether this node reacts shallowly.
 * @param {boolean} [config.terminal=false] - Whether this node is a sink node and cannot be a dependency to other nodes.
 * @returns {ReactiveNode} A new reactive node instance.
 */
const createNode = (fnOrValue, dependencies = [], config) => {
    const isComputed = typeof fnOrValue === "function";
    const useDependenciesAsConfig = !isComputed && isPlainObject(dependencies) && !config;
    const candidateConfig = config || (useDependenciesAsConfig ? dependencies : undefined);
    const reference = candidateConfig && candidateConfig.reference === true;
    const shallow = !reference && candidateConfig && candidateConfig.shallow === true;
    const updateScheduler = candidateConfig && candidateConfig.updateScheduler;
    const notifyScheduler = candidateConfig && candidateConfig.notifyScheduler;

    let finalConfig;
    let finalDeps = dependencies;

    if (!isComputed && useDependenciesAsConfig) {
        finalConfig = { ...(candidateConfig || {}), updateScheduler, notifyScheduler };
        finalDeps = undefined;
    } else {
        finalConfig = { ...(config || candidateConfig || {}), updateScheduler, notifyScheduler };
    }

    if (reference) {
        return new ReferenceReactiveNode(fnOrValue, finalDeps, finalConfig);
    } else if (shallow) {
        return new ShallowReactiveNode(fnOrValue, finalDeps, finalConfig);
    } else {
        return new ReactiveNode(fnOrValue, finalDeps, finalConfig);
    }
};

/**
 * Creates a queued reactive node that serializes asynchronous computations.
 *
 * @param {Function} fn - The computation function to execute sequentially.
 * @param {(ReactiveNode | Composite | Function | Promise | Observable) |
 *         (ReactiveNode | Composite | Function | Promise | Observable)[] |
 *         { [key: string]: ReactiveNode | Composite | Function | Promise | Observable }} [dependencies=[]] - Dependencies for the node.
 * @param {Object} [config] - Optional configuration options.
 * @returns {ReactiveNode} A queued reactive node instance.
 */
const createQueuedNode = (fn, dependencies = [], config) => {
    if (typeof fn !== "function") {
        throw new TypeError("createQueuedNode requires a computation function.");
    }
    const shallow = config && config.shallow === true;
    if (shallow) {
        return new QueuedShallowReactiveNode(fn, dependencies, config);
    }
    return new QueuedReactiveNode(fn, dependencies, config);
};

/**
 * Executes multiple updates in batch mode to optimize performance.
 *
 * @param {Function} fn - A function containing multiple updates.
 */
const batch = (fn) => ReactiveNode.batch(fn);

const createReferenceNode = (fnOrValue, dependencies, config) => {
    if (typeof fnOrValue !== "function" && isPlainObject(dependencies) && !config) {
        config = dependencies;
        dependencies = undefined;
    }
    return createNode(fnOrValue, dependencies, {...(config || {}), reference: true, shallow: false});
};

export {NO_EMIT} from "./NO_EMIT.js";
export {createNode, createQueuedNode, batch, dispatcher, createReferenceNode};
export {nodeFactory} from "./nodeFactory.js";
export {isDagifyNode} from "./isDagifyNode.js";
export {identity} from "./identity.js";
export {ensureNode} from "./ensureNode.js";
export * from "./key-management/index.js";
