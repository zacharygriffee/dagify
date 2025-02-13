import {createNode} from "../index.js";

/**
 * Creates a lazy node factory that returns a proxy for node creation and management.
 *
 * The returned proxy behaves as follows:
 * - When a property is accessed (other than special keys), it lazily creates a node by calling
 *   `createNode(value, deps)` and caches it for future accesses.
 * - If the provided `value` is a function, the node is considered computed and the supplied
 *   dependencies (`deps`) are used. Otherwise (for non-computed nodes), the dependencies are ignored.
 * - When iterated (via Symbol.iterator), it yields nodes sequentially, creating each node on demand.
 *   The iterator will throw an error if more than `max` nodes are created.
 * - A special "clear" method is exposed on the proxy. Calling `clear()` deletes all stored nodes.
 *   If a node has a `complete` method, that method is invoked before deletion.
 * - The proxy supports property enumeration and deletion via the respective traps.
 *
 * @param {*} value - The value to be used when creating nodes. If this is a function, the node is computed,
 *   and dependencies will be applied. Otherwise, dependencies are ignored.
 * @param {*|Array} deps - The dependency (or array of dependencies) to be passed to each node creation,
 *   but only if `value` is a function.
 * @param {number} [max=1000] - The maximum number of nodes that can be created via the iterator.
 * @returns {Proxy} A proxy object that lazily creates and manages nodes.
 *
 * @example
 * // For computed nodes:
 * const computedFactory = nodeFactory((deps) => deps.reduce((sum, dep) => sum + dep.value, 0), [dep1, dep2]);
 * const computedNode = computedFactory.someKey;
 *
 * // For non-computed (static) nodes, dependencies are ignored:
 * const staticFactory = nodeFactory(42, [dep1, dep2]);
 * const staticNode = staticFactory.someKey; // Uses 42; dependencies are not used.
 *
 * // Using the iterator to get nodes:
 * for (const node of computedFactory) {
 *   console.log(node);
 *   // Break out of the loop when finished to avoid infinite iteration.
 * }
 *
 * // Clear all stored nodes:
 * computedFactory.clear();
 */
const nodeFactory = (value, deps, max = 1000) => {
    // If the value is not a function (i.e. the node is not computed), ignore dependencies.
    if (typeof deps === "number") {
        max = deps;
        deps = [];
    }
    if (typeof value !== 'function') {
        deps = [];
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
                        if (!indexed[i]) indexed[i] = createNode(value, deps);
                        yield indexed[i];
                        i++;
                    }
                };
            }

            // Expose a clear() method to delete all stored nodes.
            if (key === 'clear') {
                return () => {
                    // Delete each stored node via the deleteProperty trap.
                    for (const k of Reflect.ownKeys(obj)) {
                        delete proxy[k];
                    }
                    // Reset the indexed array for lazy creation.
                    indexed.length = 0;
                };
            }

            // Lazily create nodes on property access.
            return obj[key] ||= createNode(value, deps);
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
                if (obj[prop] && typeof obj[prop].complete === 'function') {
                    obj[prop].complete();
                }
                return delete obj[prop];
            }
            return true;
        }
    });

    return proxy;
};

export {nodeFactory};