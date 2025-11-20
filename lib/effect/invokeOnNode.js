import { createSinkNode } from "../sink-node/index.js";

/**
 * Creates a sink node that invokes a method on every emitted value (if present).
 *
 * @param {*} node - The source node or observable to listen to.
 * @param {string|symbol} methodName - The method name to invoke on each value.
 * @param {...*} args - Arguments forwarded to the invoked method.
 * @returns {*} A sink node that triggers the method when available.
 */
const invokeOnNode = (node, methodName, ...args) => {
    if (typeof methodName !== "string" && typeof methodName !== "symbol") {
        throw new TypeError("invokeOnNode expects methodName to be a string or symbol.");
    }

    return createSinkNode(value => {
        const method = value?.[methodName];
        if (typeof method === "function") {
            method.apply(value, args);
        }
        // Preserve the latest value on the sink for debugging/inspection.
        return value;
    }, node);
};

export { invokeOnNode };
