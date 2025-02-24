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
    _setValue(newValue, forceEmit = false) {
        const prevValue = this.value;
        this.value = newValue;
        // Use shallow equality instead of deep equality.
        if (forceEmit || !shallowEqual(prevValue, newValue)) {
            this._notifyAll('next', newValue);
        }
    }
}

export { ShallowReactiveNode };
