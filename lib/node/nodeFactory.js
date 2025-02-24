import { createNode } from "./index.js";

/**
 * Creates a lazy node factory that returns a proxy for node creation and management.
 *
 * For computed nodes (when `value` is a function):
 * - The second argument (`depsOrActivator`) is treated as dependencies (an array or a single dependency).
 *
 * For stateful nodes (when `value` is not a function):
 * - The second argument is interpreted as an optional activator function.
 *   The activator is called when a node is created and receives the identifier (an index for array iteration or a key for object access)
 *   and the newly created node.
 *
 * If the second argument is a number, it is interpreted as the maximum number of nodes (`max`).
 *
 * Both the dependencies/activator and max are optional.
 *
 * @param {*} value - The value to be used when creating nodes. If this is a function, the node is computed,
 *   and the second argument is treated as dependencies. Otherwise, the node is stateful and the second argument is an activator.
 * @param {*|Array|Function|number} [depsOrActivator] - For computed nodes: an array (or single dependency) to be passed to node creation.
 *   For stateful nodes: a function that is called upon node creation. If a number is provided instead, it is taken as `max`.
 * @param {number} [max] - The maximum number of nodes that can be created via the iterator. Defaults to 1000.
 *
 * @returns {Proxy} A proxy object that lazily creates and manages nodes.
 *
 * @example
 * // Computed nodes:
 * // Here, the value is a function so the second argument is treated as dependencies.
 * const computedFactory = nodeFactory(
 *   (deps) => deps.reduce((sum, dep) => sum + dep.value, 0),
 *   [dep1, dep2],
 *   100
 * );
 * const computedNode = computedFactory.someKey;
 *
 * // Stateful nodes with an activator:
 * // Here, the value is not a function so the second argument is an activator.
 * const staticFactory = nodeFactory("state", (id, node) => {
 *   console.log(`Activated node ${id}:`, node);
 * }, 100);
 * const staticNode = staticFactory.someKey; // Uses "state"; activator is invoked with ("someKey", node)
 *
 * // Stateful nodes without an activator:
 * // Here, the value is not a function and no activator is provided. The node is created as-is.
 * const simpleFactory = nodeFactory("simple", 50);
 * const simpleNode = simpleFactory.anyKey;
 *
 * // Using the iterator to get nodes:
 * for (const node of staticFactory) {
 *   console.log(node);
 *   // Break when done to avoid infinite iteration.
 * }
 *
 * // Clear all stored nodes:
 * staticFactory.clear();
 */
const nodeFactory = (value, depsOrActivator, max) => {
    // Determine max if not explicitly provided.
    if (max === undefined) {
        if (typeof depsOrActivator === "number") {
            max = depsOrActivator;
            depsOrActivator = undefined;
        } else {
            max = 1000;
        }
    }

    let deps = [];
    let activator;
    // For computed nodes (value is a function), treat depsOrActivator as dependencies.
    if (typeof value === "function") {
        deps = depsOrActivator || [];
        activator = undefined;
    } else {
        // For stateful nodes, treat depsOrActivator as an activator function.
        activator = typeof depsOrActivator === "function" ? depsOrActivator : (id, node) => node;
        deps = []; // Ignore dependencies for stateful nodes.
    }

    const indexed = [];
    const obj = {};

    const proxy = new Proxy({}, {
        get(target, key) {
            // Provide the iterator for lazy sequential node creation.
            if (key === Symbol.iterator) {
                let i = 0;
                return function* () {
                    while (i < max) {
                        if (!indexed[i]) {
                            indexed[i] = createNode(value, deps);
                            // For stateful nodes, call the activator.
                            if (typeof value !== "function" && typeof activator === "function") {
                                activator(i, indexed[i]);
                            }
                        }
                        yield indexed[i];
                        i++;
                    }
                };
            }

            // Expose a clear() method to delete all stored nodes.
            if (key === "clear") {
                return () => {
                    for (const k of Reflect.ownKeys(obj)) {
                        delete proxy[k];
                    }
                    indexed.length = 0;
                };
            }

            // Lazily create nodes on property access.
            if (!(key in obj)) {
                obj[key] = createNode(value, deps);
                // For stateful nodes, call the activator.
                if (typeof value !== "function" && typeof activator === "function") {
                    activator(key, obj[key]);
                }
            }
            return obj[key];
        },

        // Support property enumeration (e.g., Object.keys, Object.entries).
        ownKeys(target) {
            return Reflect.ownKeys(obj);
        },

        // Provide property descriptors so that properties are enumerable, writable, and configurable.
        getOwnPropertyDescriptor(target, prop) {
            if (prop in obj) {
                return {
                    value: obj[prop],
                    writable: true,
                    enumerable: true,
                    configurable: true,
                };
            }
            return undefined;
        },

        // Handle deletion of properties.
        // If a node has a `complete` method, it is invoked before the node is removed.
        deleteProperty(target, prop) {
            if (prop in obj) {
                if (obj[prop] && typeof obj[prop].complete === "function") {
                    obj[prop].complete();
                }
                return delete obj[prop];
            }
            return true;
        }
    });

    return proxy;
};

export { nodeFactory };
