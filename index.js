import { ReactiveNode } from "./lib/ReactiveNode.js";
import { fromObservable } from "./lib/util/fromObservable.js";
import { ReactiveGraph } from "./lib/ReactiveGraph.js";
import { Composite } from "./lib/Composite.js";

/**
 * Creates a new reactive node.
 *
 * @param {function|any} fnOrValue - A function (for computed nodes) or an initial value.
 * @param {ReactiveNode[]} [dependencies=[]] - The dependencies for computed nodes.
 * @returns {ReactiveNode} A new reactive node.
 */
const createNode = (fnOrValue, dependencies = []) => new ReactiveNode(fnOrValue, dependencies);

/**
 * Creates a new reactive graph.
 *
 * @param {Object} [config={}] - Configuration object for the reactive graph.
 * @returns {ReactiveGraph} A new reactive graph instance.
 */
const createGraph = (config) => new ReactiveGraph(config);

/**
 * Creates a composite from a collection of ReactiveNodes.
 *
 * @param {ReactiveNode[]|Object<string, ReactiveNode>} nodes - The nodes to include.
 * @returns {Composite} A new composite instance.
 */
const createComposite = (nodes) => {
    if (Array.isArray(nodes) || (nodes && typeof nodes === "object")) {
        return new Composite(nodes);
    }
    throw new TypeError("createComposite expects an array or an object of ReactiveNodes.");
};

/**
 * Executes multiple updates in batch mode to optimize performance.
 *
 * @param {function} fn - A function containing multiple updates.
 */
const batch = (fn) => ReactiveNode.batch(fn);

export { takeUntilCompleted } from "./lib/util/takeUntilCompleted.js";
export * from "./lib/nodes/index.js";
export { createNode, createGraph, createComposite, batch, fromObservable };
