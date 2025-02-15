import {ReactiveNode, setIdGenerator} from "./lib/ReactiveNode.js";
import {fromObservable} from "./lib/util/fromObservable.js";
import {ReactiveGraph} from "./lib/ReactiveGraph.js";
import {Composite} from "./lib/Composite.js";
import {nodeFactory} from "./lib/nodeFactory.js";
import {ShallowReactiveNode} from "./lib/ShallowReactiveNode.js";

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
// const proxy = (node) => ReactiveNode.proxify(node);
export { takeUntilCompleted } from "./lib/util/takeUntilCompleted.js";
export * from "./lib/nodes/index.js";
export { createNode, createShallowNode, createGraph, createComposite, batch, fromObservable, setIdGenerator, nodeFactory};
