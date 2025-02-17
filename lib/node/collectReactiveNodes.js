import {isRxObservable} from "../rxjs/isRxObservable.js";

/**
 * Recursively collects all reactive nodes (or observables) from a dependency structure.
 *
 * @param {*} dep - A normalized dependency.
 * @returns {Array} An array of reactive nodes.
 */
export function collectReactiveNodes(dep) {
    if (Array.isArray(dep)) {
        return dep.flatMap(collectReactiveNodes);
    } else if (dep && typeof dep === 'object') {
        // If the object itself is a dagify node or an observable, return it.
        if (dep.isDagifyNode || isRxObservable(dep)) {
            return [dep];
        }
        // Otherwise, process each property.
        return Object.values(dep).flatMap(collectReactiveNodes);
    }
    return [];
}