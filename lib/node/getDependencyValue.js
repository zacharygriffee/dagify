import {isRxObservable} from "../rxjs/isRxObservable.js";

/**
 * Recursively retrieves the current value from a dependency structure,
 * preserving its shape (array, object, or single value).
 *
 * @param {*} dep - A normalized dependency.
 * @returns {*} The current value.
 */
export function getDependencyValue(dep) {
    if (Array.isArray(dep)) {
        return dep.map(getDependencyValue);
    } else if (dep && typeof dep === 'object') {
        // If it's a dagify node (or RxObservable), force a recompute if it's a function wrapper.
        if (dep.isDagifyNode || isRxObservable(dep)) {
            // If this dagify node was created with no dependencies,
            // we assume it’s wrapping a function that should be refreshed on each get.
            if (dep.normalizedDeps) {
                const isFunctionWrapper = (Array.isArray(dep.normalizedDeps) && dep.normalizedDeps.length === 0) ||
                    (typeof dep.normalizedDeps === 'object' && Object.keys(dep.normalizedDeps).length === 0);
                if (isFunctionWrapper) {
                    dep.compute(); // force re-run the function dependency
                }
            }
            return dep.value;
        }
        // Otherwise, if it's a plain object, process each property.
        const result = {};
        for (const key in dep) {
            result[key] = getDependencyValue(dep[key]);
        }
        return result;
    }
    return dep;
}