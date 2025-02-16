import {ReactiveGraph} from "./ReactiveGraph.js";

/**
 * Creates a new reactive graph.
 *
 * @param {Object} [config={}] - Configuration object for the reactive graph.
 * @returns {ReactiveGraph} A new reactive graph instance.
 */
const createGraph = (config) => new ReactiveGraph(config);

export { createGraph };