import { map, pairwise, pipe, startWith } from '../rxjs/rxjsPrebuilt.js';

/**
 * Creates an RxJS operator that computes the element-wise differences between consecutive
 * array emissions, comparing items at corresponding indices.
 *
 * For each pair of arrays, the operator iterates over the maximum length of the two arrays
 * and compares elements at each index using a provided equality checker. If no equality checker
 * is provided, the operator uses strict equality (`===`).
 *
 * Comparison rules:
 * - If an element exists in the new array but not in the old array (or the old value is undefined),
 *   it's considered **added**.
 * - If an element exists in the old array but not in the new array (or the new value is undefined),
 *   it's considered **removed**.
 * - If both arrays have a value at an index but they differ (based on the equality checker),
 *   the new value is marked as **added** and the old value is marked as **removed**.
 * - If the elements are equal (per the equality checker), they are marked as **same**.
 *
 * By default, with `initial` set to `true`, the operator starts by comparing the first emission
 * to an empty array, so the entire first array is considered added.
 *
 * @template T
 * @param {Object} [options={}]
 * @param {boolean} [options.initial=true] - If true, emits the first array as a diff from an empty array.
 * @param {(a: T, b: T) => boolean} [options.eq] - Optional equality checker function. Defaults to strict equality.
 * @returns {import('rxjs').OperatorFunction<T[], { new?: T[], del?: T[], same?: T[] }>}
 *   An operator function that transforms a stream of arrays into a stream of diff objects.
 *
 * @example
 * // Using default strict equality.
 * // Given an initial emission of [0, 1, 2, 0] and a subsequent emission of [0, 1, 2, 2],
 * // the diff object will be:
 * // {
 * //   new: [2],  // at index 3, the new value is 2
 * //   del: [0],  // at index 3, the old value was 0
 * //   same: [0, 1, 2]  // indices 0-2 remained unchanged
 * // }
 *
 * @example
 * // Using a custom equality checker (e.g., comparing objects by id).
 * diffOperator({ eq: (a, b) => a.id === b.id });
 */
function diffOperator(options = {}) {
    let { initial = true, eq} = options;
    if (typeof eq !== "function") eq = (a, b) => a === b;
    return pipe(
        // If initial is true, start with an empty array so that the first emission is diffed against [].
        initial ? startWith([]) : source => source,
        pairwise(),
        map(function ([prev, curr]) {
            const added = [];
            const removed = [];
            const same = [];
            const maxLength = Math.max(prev.length, curr.length);
            for (let i = 0; i < maxLength; i++) {
                const oldVal = prev[i];
                const newVal = curr[i];
                if (oldVal === undefined && newVal !== undefined) {
                    // New element added.
                    added.push(newVal);
                } else if (newVal === undefined && oldVal !== undefined) {
                    // Element removed.
                    removed.push(oldVal);
                } else if (!eq(oldVal, newVal)) {
                    // Element changed.
                    added.push(newVal);
                    removed.push(oldVal);
                } else {
                    // Element is the same.
                    same.push(newVal);
                }
            }
            const diffs = {};
            if (added.length > 0) {
                diffs.new = added;
            }
            if (removed.length > 0) {
                diffs.del = removed;
            }
            if (same.length > 0) {
                diffs.same = same;
            }
            return diffs;
        })
    );
}

export { diffOperator };
