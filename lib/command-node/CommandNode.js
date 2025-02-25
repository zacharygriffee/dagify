import { ReactiveNode } from "../node/ReactiveNode.js";
import {NO_EMIT} from "../node/NO_EMIT.js";

/**
 * CommandNode is a specialized ReactiveNode for handling external commands.
 * It integrates optional data validation and filtering, and processes incoming
 * payloads using a provided handler. The node supports asynchronous handlers and
 * accepts external updates via set() and next(), making it compatible with RxJS and Svelte stores.
 *
 * @example
 * const validator = (data) => {
 *   if (typeof data.x !== "number" || typeof data.y !== "number") {
 *     return { valid: false, error: new Error("Invalid vector2 format") };
 *   }
 *   return { valid: true };
 * };
 *
 * const filter = (data) => ({ x: Math.round(data.x), y: Math.round(data.y) });
 *
 * const handler = async (data) => {
 *   // For example, compute the magnitude of the vector asynchronously.
 *   return Math.sqrt(data.x * data.x + data.y * data.y);
 * };
 *
 * const cmdNode = new CommandNode("@player/position", handler, { validator, filter });
 * // Trigger using set():
 * cmdNode.set({ x: 3.2, y: 4.7 });
 * // Or via next() for RxJS/Svelte compatibility:
 * cmdNode.next({ x: 3.2, y: 4.7 });
 *
 * // Subscribers will receive the processed result once the handler resolves.
 */
class CommandNode extends ReactiveNode {
    /**
     * Creates a new CommandNode.
     *
     * @param {string} commandName - Unique identifier for the command.
     * @param {Function} handler - Function that processes the command payload.
     *   Can return a value or a Promise resolving to a value.
     * @param {{disableBatching: boolean}} [config={}] - Optional configuration.
     * @param {Function} [config.validator] - Function that validates incoming data.
     *        Should return an object: { valid: boolean, error?: Error }.
     * @param {Function} [config.filter] - Function that transforms/filters the data.
     */
    constructor(commandName, handler, config = {}) {
        // CommandNode is a source (non-computed) node with no upstream dependencies.
        super(undefined, undefined, { skip: 1, disableBatching: true, ...config });
        this.commandName = commandName;
        this.handler = handler;
        this.validator = config.validator;
        this.filter = config.filter;
        this.map = config.map;
        this.config = config;
        this.value = NO_EMIT;
    }

    /**
     * Overrides the public set() method.
     * Processes incoming data by validating, filtering, and then executing the handler.
     * The handler's result (or resolved value, if asynchronous) is then emitted as the node's state.
     *
     * @param {*} data - The payload for the command.
     */
    async set(data) {
        if (this.map) data = this.map(data);
        if (this.filter && !await this.filter(data)) return;
        // Validate data if a validator is provided.
        if (this.validator) {
            const { valid, error } = this.validator(data);
            if (!valid) {
                this.error(error || new Error("Validation failed"));
                return;
            }
        }

        let result;
        try {
            result = this.handler(data);
        } catch (err) {
            this.error(err);
            return;
        }

        // If the result is a Promise, handle it asynchronously.
        if (result && typeof result.then === "function") {
            result
                .then((res) => this._setValue(res, true))
                .catch((err) => this.error(err));
        } else {
            this._setValue(result, true);
        }
    }

    /**
     * Overrides next() to delegate to set().
     * This makes the node compatible with RxJS Observables and Svelte stores.
     *
     * @param {*} data - The payload for the command.
     */
    next(data) {
        this.set(data);
    }

    /**
     * Optionally override _setValue to ensure our update behavior.
     * In this implementation, we simply forward to the base _setValue.
     *
     * @param {*} newValue - The new value for the node.
     * @param {boolean} [forceEmit=false] - Whether to force emission even if unchanged.
     */
    _setValue(newValue, forceEmit = false) {
        if (newValue === NO_EMIT) {
            return; // Do not emit or trigger dependents if NO_EMIT
        }
        super._setValue(newValue, forceEmit);
    }

}

export { CommandNode };
