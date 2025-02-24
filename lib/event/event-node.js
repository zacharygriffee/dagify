import {ReactiveNode} from "../node/ReactiveNode.js";
import {dispatcher} from "../dispatcher/index.js";

/**
 * Creates a reactive node that listens for an event from the global event bus.
 * @param {string} eventName - The event name to listen for.
 * @param {*} defaultValue - Default value if no event has been received.
 * @param {string} [context='global'] - Optional context (default: 'global').
 * @returns {ReactiveNode} A node that updates its value when the event is emitted.
 */
function createEventNode(eventName, defaultValue, context = 'global') {
    // Create a stateful node starting with the default value.
    const node = new ReactiveNode(defaultValue);

    // Subscribe to the event on the global event bus.
    dispatcher.on(eventName, (payload) => {
        node.set(payload);
    }, context);

    return node;
}

export { createEventNode }