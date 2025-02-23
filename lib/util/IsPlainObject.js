/**
 * Checks whether the provided value is a plain object.
 * (Buffers, arrays, typed arrays, or Dagify nodes are not considered plain objects here.)
 *
 * @param {*} obj - The value to check.
 * @returns {boolean} True if the value is a plain object.
 */
export function isPlainObject(obj) {
    return obj && typeof obj === "object" && obj.constructor === Object;
}