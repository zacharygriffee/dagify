import {CommandNode} from "./CommandNode.js";
import {dispatcher} from "../dispatcher/index.js";

/**
 * Creates a CommandNode that automatically binds to the dispatcher.
 *
 * @param {string} commandName - The command identifier.
 * @param {Function} handler - The command handler function.
 * @param {Object} [config] - Optional configuration (validator, filter, etc.).
 * @param {string} [context='global'] - Optional context for the dispatcher.
 * @returns {CommandNode} A command node that processes payloads when the dispatcher emits the command.
 */
function createCommandNode(commandName, handler, config = {}, context = 'global') {
    const node = new CommandNode(commandName, handler, config);
    dispatcher.on(commandName, (payload) => {
        node.set(payload);
    }, context);
    return node;
}

export { createCommandNode }