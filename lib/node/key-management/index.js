/**
 * @module KeyGenerator
 */

import { defaultKeyGenerator } from "./defaultKeyGenerator.js";

/**
 * A private map that stores registered key generator functions.
 * Each key generator is associated with a unique name.
 *
 * **Note:** All key generator functions must return a key that is a 32 byte Uint8Array.
 *
 * @type {Map<string, Function>}
 * @private
 */
const keyGenerator = new Map();

/**
 * The current active key generator function.
 * By default, this is set to the imported `defaultKeyGenerator`.
 *
 * **Note:** The key generator function must return a key that is a 32 byte buffer.
 *
 * @type {Function}
 */
export let currentKeyGenerator = defaultKeyGenerator;

/**
 * Registers a custom key generator function under a given name.
 *
 * **Note:** The key generator function must return a key that is a 32 byte buffer.
 *
 * @param {string} name - A unique identifier for the key generator.
 * @param {Function} generator - The key generator function that produces keys.
 * @returns {void}
 *
 * @example
 * registerKeyGenerator("uuidGenerator", () => {
 *   // Returns a 32 byte buffer as key
 *   return Buffer.alloc(32);
 * });
 */
export const registerKeyGenerator = (name, generator) => {
    keyGenerator.set(name, generator);
};

/**
 * Sets the active key generator function.
 * If a name is provided and a corresponding generator exists, it becomes active.
 * Otherwise, the default key generator is used.
 *
 * **Note:** The key generator function must return a key that is a 32 byte buffer.
 *
 * @param {string} [name] - The name of the key generator to activate.
 * @returns {void}
 *
 * @example
 * // Switch to the custom key generator "uuidGenerator"
 * useKeyGenerator("uuidGenerator");
 */
export const useKeyGenerator = (name) => {
    currentKeyGenerator = name ? keyGenerator.get(name) : defaultKeyGenerator;
};

/**
 * Temporarily sets the active key generator function for the duration of a callback execution.
 * After the callback is executed, the original key generator is restored.
 *
 * **Note:** The key generator function must return a key that is a 32 byte buffer.
 *
 * @param {string} name - The name of the key generator to use temporarily.
 * @param {Function} cb - The callback function to execute while the temporary generator is active.
 * @returns {void}
 *
 * @example
 * // Temporarily use "uuidGenerator" during the callback execution
 * useKeyGeneratorWhile("uuidGenerator", () => {
 *   console.log(currentKeyGenerator());
 * });
 */
export const useKeyGeneratorWhile = (name, cb) => {
    const old = currentKeyGenerator;
    useKeyGenerator(name);
    cb();
    currentKeyGenerator = old;
};

registerKeyGenerator("default", defaultKeyGenerator);
useKeyGenerator("default");