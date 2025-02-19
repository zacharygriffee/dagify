import {ReactiveNode} from "./ReactiveNode.js";
import {Subject} from 'rxjs';
import {getDependencyValue} from "./getDependencyValue.js";
import {isRxObservable} from "../rxjs/isRxObservable.js";

/**
 * ExecutionNode extends ReactiveNode so that values are only emitted when
 * the node is explicitly triggered (either via an external execution stream
 * or by calling triggerExecution()). This applies to both stateful (static)
 * and computed nodes.
 *
 * For computed nodes, automatic dependency-triggered updates are suppressed.
 */
class ExecutionNode extends ReactiveNode {
    constructor(fnOrValue, dependencies, executionStream, config) {
        // Determine if this is a computed node.
        const isComputed = typeof fnOrValue === 'function';
        // For static nodes, ignore dependencies.
        const deps = isComputed ? dependencies : undefined;

        if (!isComputed) {
            config = executionStream;
            executionStream = dependencies;
        }

        const hasCustomExecutionStream = isRxObservable(executionStream);
        // Call the base constructor.
        super(fnOrValue, deps, hasCustomExecutionStream ? config : executionStream);

        // For computed nodes, remove automatic dependency subscriptions
        // and lock the node into manual mode.
        if (isComputed && this._dependencySubscriptions) {
            this._dependencySubscriptions.forEach(unsub => unsub());
            this._dependencySubscriptions = [];
            this._manualMode = true;
        }

        // Use the provided executionStream or create a new Subject.
        this.executionStream = hasCustomExecutionStream ? executionStream : new Subject();

        // Subscribe to the execution stream.
        // When the stream emits, force a manual recomputation (or re-emit for static nodes).
        this._executionSubscription = this.executionStream.subscribe(() => {
            if (isComputed) {
                this.compute(true); // Force recomputation and emission.
            } else {
                // For static (stateful) nodes, simply emit the current value.
                this._notifyAll('next', this.value);
            }
        });
    }

    /**
     * Override compute() so that if the node is in manual mode (for computed nodes),
     * automatic compute calls are ignored. When forced (manualTrigger=true), we
     * always recompute and emit the value.
     *
     * @param {boolean} manualTrigger - If true, forces recomputation and emission.
     */
    compute(manualTrigger = false) {
        if (this.fn && this._manualMode) {
            // Always recompute on manual trigger.
            if (manualTrigger) {
                const depValue = getDependencyValue(this.normalizedDeps);
                let result;
                if (Array.isArray(this.normalizedDeps) && this.fn.length !== 1) {
                    result = this.fn(...depValue);
                } else {
                    result = this.fn(depValue);
                }
                this._lastComputed = result;
                // Force emission even if the value hasn't changed.
                this._setValue(result, true);
                return;
            }
            // In manual mode, do nothing on automatic calls.
            return;
        }
        // For static nodes or non-manual mode, use the base compute.
        super.compute();
    }

    /**
     * Override _subscribeCore so that subscribers are added but no initial value is emitted.
     * This ensures that the node only emits when triggered.
     *
     * @param {Function|Object} observer - The observer to subscribe.
     * @returns {Function} Unsubscribe function.
     * @private
     */
    _subscribeCore(observer) {
        if (this._completed) {
            if (typeof observer.complete === 'function') observer.complete();
            return () => {};
        }

        const subscriber = this._initializeObserver(observer);
        this.subscribers.add(subscriber);

        if (typeof subscriber.next === 'function') {
            if (this._error !== undefined) {
                if (typeof subscriber.error === 'function') {
                    subscriber.error(this._error);
                }
                subscriber.closed = true;
            }
            // Do NOT emit an initial value on subscription.
            subscriber.lastEmitted = this.value;
        }
        // Do NOT reinitialize dependency subscriptions here.
        const unsubscribe = () => {
            subscriber.closed = true;
            this.subscribers.delete(subscriber);
        };
        unsubscribe.unsubscribe = unsubscribe;
        return unsubscribe;
    }

    /**
     * Override _getTriggerCallback to return a no-op since dependency changes
     * should not trigger auto-updates in manual mode.
     *
     * @returns {Function} A no-op callback.
     * @private
     */
    _getTriggerCallback() {
        return () => {};
    }

    /**
     * Manually triggers execution.
     * For computed nodes, this forces a recomputation and emission.
     * For stateful nodes, it emits the current value.
     */
    triggerExecution() {
        // For computed nodes, this immediately forces a recomputation.
        // For static nodes, it simply emits the current value.
        if (this.fn) {
            this.compute(true);
        } else {
            this._notifyAll('next', this.value);
        }
    }

    /**
     * Cleans up the execution subscription.
     */
    dispose() {
        if (this._executionSubscription) {
            this._executionSubscription.unsubscribe();
        }
    }
}

export { ExecutionNode };
