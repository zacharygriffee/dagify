import {ReactiveNode} from '../node/ReactiveNode.js';
import {cloneForComparison} from '../util/cloneForComparison.js';
import {NO_EMIT} from '../node/NO_EMIT.js';

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
        if (newValue === NO_EMIT) return;
        if (!this._validateType(newValue)) {
            const typeErr = new Error(`Type mismatch: value does not conform to type "${this._type}"`);
            this.error(typeErr);
            return;
        }
        const prevSnapshot = this._snapshot;
        const nextSnapshot = cloneForComparison(newValue);
        this._internalUpdate = true;
        this.value = newValue;
        this._internalUpdate = false;
        this._snapshot = nextSnapshot;
        // Use shallow equality instead of deep equality.
        if (forceEmit || !shallowEqual(prevSnapshot, nextSnapshot)) {
            this._notifyAll('next', newValue);
        }
    }
}

export { ShallowReactiveNode };
