/**
 * Creates a structural clone for comparison so that downstream mutations
 * on the live reference do not affect stored snapshots.
 *
 * @param {*} value - The value to clone.
 * @returns {*} The cloned value or the original for primitives.
 */
export const cloneForComparison = (value, seen = new WeakMap()) => {
    if (value === null || typeof value !== "object") {
        return value;
    }
    if (seen.has(value)) {
        return seen.get(value);
    }
    if (Array.isArray(value)) {
        const clone = [];
        seen.set(value, clone);
        for (let i = 0; i < value.length; i++) {
            clone[i] = cloneForComparison(value[i], seen);
        }
        return clone;
    }
    if (value instanceof Date) {
        return new Date(value.getTime());
    }
    if (value instanceof RegExp) {
        return new RegExp(value.source, value.flags);
    }
    if (ArrayBuffer.isView(value)) {
        return value.slice ? value.slice() : value.subarray(0);
    }
    const clone = {};
    seen.set(value, clone);
    for (const key of Object.keys(value)) {
        clone[key] = cloneForComparison(value[key], seen);
    }
    return clone;
};
