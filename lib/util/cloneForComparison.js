/**
 * Creates a structural clone for comparison so that downstream mutations
 * on the live reference do not affect stored snapshots.
 *
 * @param {*} value - The value to clone.
 * @returns {*} The cloned value or the original for primitives.
 */
export const cloneForComparison = (value) => {
    if (value === null || typeof value !== "object") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(cloneForComparison);
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
    return cloneObjectLike(value);
};

const cloneObjectLike = (source) => {
    const clone = {};
    for (const key of Object.keys(source)) {
        clone[key] = cloneForComparison(source[key]);
    }
    return clone;
};
