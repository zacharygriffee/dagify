import { ReactiveNode } from "./lib/ReactiveNode.js";
import { fromObservable } from "./lib/fromObservable.js";
import { ReactiveGraph } from "./lib/ReactiveGraph.js";
/**
 * Creates a new reactive node.
 *
 * This function creates either a **stateful node** (holding a value)
 * or a **computed node** (derived from dependencies).
 *
 * - If `fnOrValue` is a function, the node is computed and updates automatically.
 * - If `fnOrValue` is a value, the node holds that value and can be manually updated.
 *
 * @param {function|any} fnOrValue - A function (for computed nodes) or an initial value.
 * @param {ReactiveNode[]} [dependencies=[]] - The dependencies for computed nodes.
 * @returns {ReactiveNode} A new reactive node.
 *
 * @example
 * // Creating a simple reactive node with a value
 * const count = createNode(1);
 * count.subscribe(value => console.log("Count:", value));
 * count.set(5); // Logs: "Count: 5"
 *
 * @example
 * // Creating a computed node that reacts to changes
 * const count = createNode(1);
 * const double = createNode(([count]) => count * 2, [count]);
 *
 * double.subscribe(value => console.log("Double:", value));
 * count.set(5); // Logs: "Double: 10"
 */
const createNode = (fnOrValue, dependencies = []) => new ReactiveNode(fnOrValue, dependencies);

/**
 * Creates a new reactive graph.
 *
 * This function initializes a ReactiveGraph instance with an optional configuration.
 *
 * @param {Object} [config={}] - Configuration object for the reactive graph.
 * @param {string} [config.keyEncoding="binary"] - Encoding type for keys.
 * @returns {ReactiveGraph} A new reactive graph instance.
 *
 * @example
 * // Creating a new reactive graph
 * const graph = createGraph({ keyEncoding: "utf-8" });
 */
const createGraph = (config) => new ReactiveGraph(config);

/**
 * Executes multiple updates in batch mode to optimize performance.
 *
 * This function wraps the static ReactiveNode.batch method so that consumers can
 * use a functional API. All updates performed inside the passed function are batched,
 * and subscribers will only receive the final value.
 *
 * @param {function} fn - A function containing multiple updates.
 *
 * @example
 * import { createNode, batch } from "./index.js";
 *
 * const count = createNode(0);
 * batch(() => {
 *   count.set(1);
 *   count.set(2);
 *   count.set(3);
 * });
 * // Subscribers will only see the final value (3).
 */
const batch = (fn) => ReactiveNode.batch(fn);

export { takeUntilCompleted } from "./lib/takeUntilCompleted.js";
export * from "./lib/nodes/index.js";
export { createNode, createGraph, batch, fromObservable };
