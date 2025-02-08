import { isObservable } from "./rxjsPrebuilt.js";

/**
 * Checks if an object is an RxJS-like observable.
 * We assume that dagify nodes are callable (functions) while observables are not.
 * @param {any} obj
 * @returns {boolean}
 */
function isRxObservable(obj) {
    return isObservable(obj) && !obj.isDagifyNode;
}

export { isRxObservable }