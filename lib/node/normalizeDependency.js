import {isRxObservable} from "../rxjs/isRxObservable.js";
import {fromObservable} from "../util/fromObservable.js";
import {NO_EMIT} from "./NO_EMIT.js";

let ReactiveNodeCtor;
const setNormalizeDependencyCtor = (ctor) => {
    ReactiveNodeCtor = ctor;
};
const getCtor = () => {
    if (!ReactiveNodeCtor) {
        throw new Error("ReactiveNode constructor not registered for normalizeDependency.");
    }
    return ReactiveNodeCtor;
};

/**
 * Normalizes a dependency into its “reactive” form:
 * - Arrays are recursively normalized.
 * - Plain objects have each property normalized.
 * - Functions (that are not dagify nodes) are wrapped so that each subscription gets a fresh value.
 *
 * @param {*} dep - The dependency to normalize.
 * @returns {*} The normalized dependency.
 */
export function normalizeDependency(dep) {
    if (Array.isArray(dep)) {
        return dep.map(normalizeDependency);
    } else if (dep && typeof dep === 'object') {
        // If it's already a dagify node, leave it as is.
        if (dep.isDagifyNode) return dep;
        // If it's an RxObservable, wrap it.
        if (isRxObservable(dep)) return fromObservable(dep, NO_EMIT);
        // Otherwise, assume it’s a plain object with dependencies.
        const result = {};
        for (const key in dep) {
            result[key] = normalizeDependency(dep[key]);
        }
        return result;
    } else if (typeof dep === 'function') {
        // Instead of wrapping with an asynchronous observable,
        // wrap the function into a computed node with no dependencies.
        // This ensures that the function is re-evaluated synchronously on each update.
        const NodeCtor = getCtor();
        return new NodeCtor(dep, []);
    }
    // For static values, return as is.
    return dep;
}

export { setNormalizeDependencyCtor };
