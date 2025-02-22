import {Composite} from "./Composite.js";

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

export { createComposite }