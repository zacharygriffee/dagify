import { Subject } from './rxjsPrebuilt.js';
import { fromObservable } from "./fromObservable.js";
import { isRxObservable } from "./isRxObservable.js";

/**
 * Represents a reactive node in a directed acyclic graph (DAG).
 * Supports computed values, subscriptions, error handling, and completion.
 *
 * @class ReactiveNode
 * @extends {Subject}
 */
class ReactiveNode extends Subject {
    /**
     * A set of ReactiveNodes pending updates.
     *
     * @static
     * @type {Set<ReactiveNode>}
     */
    static pendingUpdates = new Set();

    /**
     * Indicates whether an update is currently being processed.
     *
     * @static
     * @type {boolean}
     */
    static updating = false;

    /**
     * Flag to indicate if batch mode is enabled.
     *
     * @static
     * @type {boolean}
     */
    static batchMode = false;

    /**
     * Indicates that this node is a Dagify node.
     *
     * @type {boolean}
     */
    get isDagifyNode() {
        return true;
    }

    /**
     * Creates a new ReactiveNode.
     *
     * @param {Function|*} fnOrValue - A function for a computed node or a direct value.
     * @param {Array<ReactiveNode|Observable>} [dependencies=[]] - An array of dependency nodes or observables.
     *        If any dependency is an observable, it is wrapped as a ReactiveNode.
     */
    constructor(fnOrValue, dependencies = []) {
        super();

        /**
         * Unique identifier for the node.
         * @type {string}
         */
        this.id = `Node-${Math.random().toString(36).slice(2, 9)}`;

        /**
         * Set of subscriber observers.
         * @type {Set<Object>}
         */
        this.subscribers = new Set();

        /**
         * Flag indicating whether the node has been completed.
         * @type {boolean}
         * @private
         */
        this._completed = false;

        // Wrap any observable dependency into a ReactiveNode.
        this.dependencies = dependencies.map(dep =>
            isRxObservable(dep) ? fromObservable(dep, undefined) : dep
        );

        if (typeof fnOrValue === 'function') {
            /**
             * Computation function used to derive the node's value.
             * @type {Function}
             */
            this.fn = fnOrValue;

            /**
             * The current computed value of the node.
             * @type {*}
             */
            this.value = undefined;

            /**
             * Array of unsubscribe functions for dependency subscriptions.
             * @type {Array<Function>}
             * @private
             */
            this._dependencySubscriptions = this._initializeDependencySubscriptions(this.dependencies);

            this.compute();
        } else {
            this.fn = null;
            this.value = fnOrValue;
            this.dependencies = [];
        }
    }

    /**
     * Schedules an update for the given ReactiveNode.
     *
     * In batch mode, the node is simply added to the pending updates set.
     * Otherwise, if an update is not already in progress, a microtask is scheduled to compute
     * all pending nodes.
     *
     * @param {ReactiveNode} node - The node to update.
     * @static
     */
    static scheduleUpdate(node) {
        if (ReactiveNode.batchMode) {
            ReactiveNode.pendingUpdates.add(node);
            return;
        }
        ReactiveNode.pendingUpdates.add(node);
        if (!ReactiveNode.updating) {
            ReactiveNode.updating = true;
            queueMicrotask(() => {
                ReactiveNode.pendingUpdates.forEach((n) => n.compute());
                ReactiveNode.pendingUpdates.clear();
                ReactiveNode.updating = false;
            });
        }
    }

    /**
     * Executes a function in batch mode, deferring updates until the batch completes.
     *
     * @param {Function} fn - A function containing multiple node update operations.
     * @static
     */
    static batch(fn) {
        ReactiveNode.batchMode = true;
        fn();
        ReactiveNode.batchMode = false;
        ReactiveNode.pendingUpdates.forEach((n) => n.compute());
        ReactiveNode.pendingUpdates.clear();
    }

    /**
     * Computes the node's value using its computation function and dependency values.
     * Notifies subscribers with the new value or an error if one occurs.
     *
     * @returns {void}
     */
    compute() {
        if (!this.fn) return;
        try {
            const newValue = this.fn(this.dependencies.map((dep) => dep.value));
            this._setValue(newValue);
            this._error = undefined; // Clear any previous error if computation succeeds.
        } catch (err) {
            this._error = err;
            this._notifyAll('error', err);
        }
    }

    /**
     * Sets a new value for a non-computed node.
     *
     * @param {*} newValue - The new value to set.
     * @throws {Error} Throws an error if attempting to set a computed node.
     */
    set(newValue) {
        if (this.fn) throw new Error("Cannot manually set a computed node");
        this._setValue(newValue);
    }

    /**
     * Triggers an update for the node.
     * For computed nodes, this will recalculate the value; for non-computed nodes, it will set the new value.
     *
     * @param {*} value - The value to be processed.
     */
    next(value) {
        this.fn ? this.compute() : this.set(value);
    }

    /**
     * Subscribes an observer to the node.
     *
     * @param {Object|Function} observer - An observer object with `next`, `error`, and `complete` methods, or a callback function.
     * @returns {Function} A function to unsubscribe the observer.
     */
    subscribe(observer) {
        return this._subscribeCore(observer, { skipInitialValue: false });
    }

    /**
     * Provides a subscription interface that skips the immediate emission of the current value.
     *
     * @type {{ subscribe: function(observer: Object|Function): Function }}
     */
    get skip() {
        return {
            subscribe: (observer) => this._subscribeCore(observer, { skipInitialValue: true })
        };
    }

    /**
     * Subscribes an observer to receive only one emission, then immediately unsubscribes.
     *
     * @param {Object|Function} observer - An observer or callback function.
     * @returns {Function} A no-op unsubscribe function.
     */
    subscribeOnce(observer) {
        // Normalize the observer to an object.
        if (typeof observer === 'function') {
            observer = { next: observer };
        }

        this.subscribe({
            ...observer,
            next: (value) => {
                if (typeof observer.next === 'function') observer.next(value);
            },
        }).unsubscribe();
        return Object.assign(() => {}, { unsubscribe: () => {} });
    }

    /**
     * Provides a subscription interface for a one-time subscription.
     *
     * @type {{ subscribe: function(observer: Object|Function): Function }}
     */
    get once() {
        return {
            subscribe: (observer) => this.subscribeOnce(observer)
        };
    }

    /**
     * Notifies subscribers of an error.
     *
     * @param {Error} err - The error to notify.
     */
    error(err) {
        this._notifyAll('error', err);
    }

    /**
     * Completes the node by notifying subscribers, clearing subscribers, and unsubscribing from dependencies.
     *
     * @returns {void}
     */
    complete() {
        this._completed = true;
        this._notifyAll('complete');
        this.subscribers.clear();
        this._unsubscribeDependencies();
    }

    /**
     * Internal method to update the node's value and notify subscribers if the value has changed.
     *
     * @param {*} newValue - The new value to set.
     * @private
     */
    _setValue(newValue) {
        const prevValue = this.value;
        this.value = newValue;
        if (prevValue !== newValue) {
            this._notifyAll('next', newValue);
        }
    }

    /**
     * Core subscription method that adds an observer and handles immediate emission of the current value.
     *
     * @param {Object|Function} observer - An observer or a callback function.
     * @param {Object} [options={ skipInitialValue: false }] - Subscription options.
     * @param {boolean} [options.skipInitialValue=false] - If true, the current value is not immediately emitted.
     * @returns {Function} A function to unsubscribe the observer.
     * @private
     */
    _subscribeCore(observer, { skipInitialValue = false } = {}) {
        if (this._completed) {
            if (typeof observer.complete === 'function') observer.complete();
            return () => {};
        }

        const subscriber = this._initializeObserver(observer, skipInitialValue);
        this.subscribers.add(subscriber);

        // Immediately emit the current value if not skipping and if no error has occurred.
        if (!skipInitialValue && typeof subscriber.next === 'function') {
            if (this._error !== undefined) {
                // If an error occurred, notify the error immediately.
                if (typeof subscriber.error === 'function') {
                    subscriber.error(this._error);
                }
                subscriber.closed = true;
            } else {
                subscriber.next(this.value);
                subscriber.lastEmitted = this.value;
            }
        }

        if (this.fn && !this._dependencySubscriptions?.length) {
            this._dependencySubscriptions = this._initializeDependencySubscriptions(this.dependencies);
            ReactiveNode.scheduleUpdate(this);
        }

        // Return an unsubscribe function.
        const unsubscribe = () => {
            subscriber.closed = true;
            this.subscribers.delete(subscriber);
            if (this.subscribers.size === 0) this._unsubscribeDependencies();
        };
        unsubscribe.unsubscribe = unsubscribe;
        return unsubscribe;
    }

    /**
     * Normalizes an observer input into an observer object with `next`, `error`, and `complete` methods.
     *
     * @param {Object|Function} observer - The observer or callback function.
     * @param {boolean} skipInitialValue - Whether to skip immediate emission of the current value.
     * @returns {Object} The normalized observer.
     * @private
     */
    _initializeObserver(observer, skipInitialValue) {
        if (typeof observer === 'function') {
            observer = { next: observer };
        }
        return {
            next: observer.next,
            error: observer.error,
            complete: observer.complete,
            closed: false,
            lastEmitted: skipInitialValue ? this.value : undefined,
            errorNotified: false,
        };
    }

    /**
     * Notifies all subscribers of a specific event type.
     *
     * @param {string} type - The type of event ('next', 'error', or 'complete').
     * @param {*} [value] - The value or error to pass to the subscribers.
     * @private
     */
    _notifyAll(type, value) {
        this.subscribers.forEach((subscriber) => {
            if (subscriber.closed) return;
            queueMicrotask(() => {
                if (type === 'error' && !subscriber.errorNotified && typeof subscriber.error === 'function') {
                    subscriber.error(value);
                    subscriber.errorNotified = true;
                    subscriber.closed = true;
                } else if (type === 'next' && subscriber.lastEmitted !== value) {
                    subscriber.next?.(value);
                    subscriber.lastEmitted = value;
                } else if (type === 'complete' && typeof subscriber.complete === 'function') {
                    subscriber.complete();
                    subscriber.closed = true;
                }
            });
        });
    }

    /**
     * Subscribes to all dependency nodes so that any change triggers an update of this node.
     *
     * @param {Array<ReactiveNode>} dependencies - The dependencies to subscribe to.
     * @returns {Array<Function>} An array of unsubscribe functions for each dependency.
     * @private
     */
    _initializeDependencySubscriptions(dependencies) {
        return dependencies.map((dep) =>
            dep.subscribe(() => ReactiveNode.scheduleUpdate(this))
        );
    }

    /**
     * Unsubscribes from all dependency subscriptions.
     *
     * @private
     */
    _unsubscribeDependencies() {
        this._dependencySubscriptions?.forEach((unsubscribe) => unsubscribe());
        this._dependencySubscriptions = [];
    }
}

export { ReactiveNode };
