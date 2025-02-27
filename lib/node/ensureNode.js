import {createNode} from "./index.js";

/**
 * Ensures that the provided value is a DagifyNode.
 *
 * If the input object `x` already has the `isDagifyNode` property set to a truthy value, it is
 * assumed to be a valid DagifyNode and is returned as is. Otherwise, a new DagifyNode is created
 * using the `createNode` function with the provided configuration.
 *
 * @param {Object} x - The value to be validated or converted.
 * @param {boolean} x.isDagifyNode - Flag that indicates whether `x` is already a DagifyNode.
 * @param {Object} config - Configuration options for creating a new DagifyNode if necessary.
 * @returns {Object} A DagifyNode instance.
 */
const ensureNode = (x, config) => x.isDagifyNode ? x : createNode(x, config);

export { ensureNode };