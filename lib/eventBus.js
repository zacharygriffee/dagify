/**
 * Dispatcher acts as a centralized event dispatcher for IPC-like event routing.
 * It allows subscribers to listen for events by name (with an optional context)
 * and emits events to all matching subscribers. It supports subscribing via `on`
 * and unsubscribing via both the returned unsubscribe function and an explicit `off` method.
 */
class Dispatcher {
    constructor() {
        /**
         * A Map that holds sets of subscribers keyed by a unique combination of event name and context.
         * @type {Map<string, Set<Function>>}
         */
        this.subscribers = new Map();
    }

    /**
     * Subscribe to an event.
     *
     * @param {string} eventName - The name of the event to subscribe to.
     * @param {Function} handler - The callback function to invoke when the event is emitted.
     * @param {string} [context='global'] - Optional context for the event subscription (defaults to 'global').
     * @returns {Function} An unsubscribe function to remove the subscription.
     *
     * @example
     * const unsubscribe = bus.on("myEvent", (payload) => {
     *   console.log("Received:", payload);
     * });
     *
     * // Later, to unsubscribe:
     * unsubscribe();
     */
    on(eventName, handler, context = 'global') {
        const key = this._getKey(eventName, context);
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        const handlers = this.subscribers.get(key);
        handlers.add(handler);

        // Return an unsubscribe function.
        return () => this.off(eventName, handler, context);
    }

    /**
     * Unsubscribe a handler from an event.
     *
     * @param {string} eventName - The name of the event to unsubscribe from.
     * @param {Function} handler - The handler to remove.
     * @param {string} [context='global'] - Optional context of the event subscription (defaults to 'global').
     *
     * @example
     * bus.off("myEvent", myHandler);
     */
    off(eventName, handler, context = 'global') {
        const key = this._getKey(eventName, context);
        const handlers = this.subscribers.get(key);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.subscribers.delete(key);
            }
        }
    }

    /**
     * Emit an event to all subscribers registered for the event name and context.
     *
     * @param {string} eventName - The name of the event to emit.
     * @param {*} payload - The payload/data to pass to event handlers.
     * @param {string} [context='global'] - Optional context for the event (defaults to 'global').
     *
     * @example
     * bus.emit("myEvent", { foo: "bar" });
     */
    emit(eventName, payload, context = 'global') {
        const key = this._getKey(eventName, context);
        const handlers = this.subscribers.get(key);
        if (handlers) {
            handlers.forEach(handler => handler(payload));
        }

        // Optionally support fallback to the global context if a non-global context is specified.
        if (context !== 'global') {
            const globalKey = this._getKey(eventName, 'global');
            const globalHandlers = this.subscribers.get(globalKey);
            if (globalHandlers) {
                globalHandlers.forEach(handler => handler(payload));
            }
        }
    }

    /**
     * Generates a unique key by combining the event name and context.
     *
     * @private
     * @param {string} eventName - The event name.
     * @param {string} context - The context.
     * @returns {string} A combined key string.
     */
    _getKey(eventName, context) {
        return `${context}:${eventName}`;
    }
}


// Instantiate the global event bus.
const dispatcher = new Dispatcher();
/**
 * The use() function takes a plugin callback that receives the dispatcher,
 * allowing the plugin to register its own event listeners and emitters.
 *
 * @param {Function} pluginFn - A function that receives the dispatcher.
 */
function use(pluginFn) {
    if (typeof pluginFn === 'function') {
        pluginFn(dispatcher);
    }
}

export { dispatcher, use };
