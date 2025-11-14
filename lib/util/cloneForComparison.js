import { isPlainObject } from "./IsPlainObject.js";

/**
 * Creates a structural clone for comparison so that downstream mutations
 * on the live reference do not affect stored snapshots.
 *
 * @param {*} value - The value to clone.
 * @returns {*} The cloned value or the original for primitives/non-plain values.
 */
export const cloneForComparison = (value) => {
    if (Array.isArray(value)) {
        return value.map(cloneForComparison);
    }
    if (isPlainObject(value)) {
        const clone = {};
        for (const key of Object.keys(value)) {
            clone[key] = cloneForComparison(value[key]);
        }
        return clone;
    }
    return value;
};
