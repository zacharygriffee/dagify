import {ReactiveNode} from '../node/ReactiveNode.js';
import {NO_EMIT} from '../node/NO_EMIT.js';

class ReferenceReactiveNode extends ReactiveNode {
    _setValue(newValue, forceEmit = false) {
        if (newValue === NO_EMIT) return;
        if (!this._validateType(newValue)) {
            const typeErr = new Error(`Type mismatch: value does not conform to type "${this._type}"`);
            this.error(typeErr);
            return;
        }
        const prev = this._snapshot;
        this._internalUpdate = true;
        this.value = newValue;
        this._internalUpdate = false;
        this._snapshot = newValue;
        const comparator = this._compare || ((a, b) => a === b);
        if (forceEmit || !comparator(prev, newValue)) {
            this._notifyAll('next', newValue);
        }
    }
}

export { ReferenceReactiveNode };
