import {ReactiveNode} from '../node/ReactiveNode.js';

function shallowEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (let key of aKeys) {
        if (a[key] !== b[key]) return false;
    }
    return true;
}

class ShallowReactiveNode extends ReactiveNode {
    _valuesEqual(prevSnapshot, nextSnapshot) {
        const comparator = this._compare || shallowEqual;
        return comparator(prevSnapshot, nextSnapshot);
    }
}

export { ShallowReactiveNode };
