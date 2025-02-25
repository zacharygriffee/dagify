import { isObservable } from "./rxjsPrebuilt.js";

/**
 * Checks if an object is an RxJS-like observable.
 * We assume that dagify has isDagifyNdoe property true.
 * @param {any} obj
 * @returns {boolean}
 */
function isRxObservable(obj) {
    return isObservable(obj) && !obj.isDagifyNode;
}

export { isRxObservable }