import { createNode } from "../node/index.js";

/**
 * Creates a sink node, intended to be used as a terminal consumer for side effects.
 *
 * A sink node is designed to react to upstream values and execute side effects (e.g., logging, writing to a socket)
 * without being used as a dependency in further computations. This function leverages the standard node creation
 * mechanism, but with no dependencies, effectively marking it as a sink.
 *
 * @param {Function|*} fnOrValue - A function that defines the computed behavior for the node or a static value.
 * @param dependencies
 * @param {Object} [config] - Optional configuration settings for the node.
 *        Other configuration options may be passed based on the underlying implementation of createNode.
 * @returns {ReactiveNode} The created sink node.
 */
const createSinkNode = (fnOrValue, dependencies, config = {}) => createNode(fnOrValue, dependencies, { ...config, sink: true });

export { createSinkNode };
