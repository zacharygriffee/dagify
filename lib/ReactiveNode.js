import Subject from './SubjectPreBuild.js';

/**
 * Represents a reactive node in a directed acyclic graph (DAG).
 * Supports computed values, subscriptions, error handling, and completion.
 */
class ReactiveNode extends Subject {
    /** @type {Set<ReactiveNode>} Nodes pending updates */
    static pendingUpdates = new Set();
    /** @type {boolean} Whether an update is in progress */
    static updating = false;
    /** @type {boolean} Whether batch mode is active */
    static batchMode = false;

    /**
     * Creates a new reactive node.
     * @param {function|any} fnOrValue - A function for computed nodes or an initial value.
     * @param {ReactiveNode[]} [dependencies=[]] - The dependencies for computed nodes.
     */
    constructor(fnOrValue, dependencies = []) {
        super();

        /** @type {string} Unique identifier for debugging */
        this.id = `Node-${Math.random().toString(36).slice(2, 9)}`;
        /**
         * @type {Set<ReactiveNode|{next: function(any): void, error?: function(any): void, complete?: function(), closed: boolean, lastEmitted?: any}>}
         * Subscribers listening to this node.
         */
        this.subscribers = new Set();
        /** @type {boolean} Marks whether this node has been completed */
        this._completed = false;

        if (typeof fnOrValue === 'function') {
            // Computed node.
            this.fn = fnOrValue;
            this.dependencies = dependencies;
            this.value = undefined;
            // Subscribe to dependencies so that any change schedules an update.
            this._dependencySubscriptions = this.dependencies.map((dep) =>
                dep.subscribe({
                    next: () => ReactiveNode.scheduleUpdate(this),
                    closed: false
                })
            );
            // Compute the initial value.
            this.compute();
        } else {
            // Regular node.
            this.fn = null;
            this.value = fnOrValue;
            this.dependencies = [];
        }
    }

    /**
     * Schedules a node update to prevent redundant computations.
     * @param {ReactiveNode} node - The node to update.
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
     * Runs multiple updates in batch mode.
     * @param {function} fn - A function containing multiple updates.
     */
    static batch(fn) {
        ReactiveNode.batchMode = true;
        fn();
        ReactiveNode.batchMode = false;
        ReactiveNode.pendingUpdates.forEach((n) => n.compute());
        ReactiveNode.pendingUpdates.clear();
    }

    /**
     * Computes the new value for computed nodes.
     */
    compute() {
        if (!this.fn) return;
        let newValue;
        try {
            newValue = this.fn(this.dependencies.map((dep) => dep.value));
            // Clear any previous error if computation succeeds.
            this._error = undefined;
        } catch (err) {
            this._error = err;
            this.notifyError(err);
            return;
        }
        const prevValue = this.value;
        this.value = newValue;
        if (prevValue !== this.value) {
            this.notify();
        }
    }


    /**
     * Sets a new value for the node.
     * @param {any} newValue - The new value to set.
     * @throws {Error} If attempting to manually set a computed node.
     */
    set(newValue) {
        if (this.fn) throw new Error("Cannot manually set a computed node");
        const prevValue = this.value;
        this.value = newValue;
        if (prevValue !== newValue) {
            this.notify();
        }
    }

    /**
     * RxJS‑compatible method to push a new value.
     * @param {any} value - The new value to push.
     */
    next(value) {
        if (this.fn) {
            this.compute();
        } else {
            this.set(value);
        }
    }

    /**
     * Subscribes an observer to listen for changes.
     * The initial emission is scheduled asynchronously.
     * @param {function|{next: function(any): void, error?: function(any): void, complete?: function()}} observer
     * @returns {function} Unsubscribe function.
     */
    subscribe(observer) {
        if (this._completed) {
            // If completed, immediately notify complete if possible.
            if (typeof observer === "function") {
                return () => {};
            } else if (observer && typeof observer.complete === "function") {
                observer.complete();
            }
            return () => {};
        }
        if (typeof observer === "function") {
            observer = {
                next: observer,
                closed: false,
                lastEmitted: undefined,
                errorNotified: false
            };
        } else {
            observer.closed = false;
            observer.lastEmitted = undefined;
            observer.errorNotified = false;
        }

        // For computed nodes: if there are no dependency subscriptions, reinitialize them.
        // Then force an update so that the computed value is refreshed.
        if (this.fn && (!this._dependencySubscriptions || this._dependencySubscriptions.length === 0)) {
            const subs = this.dependencies.map((dep) => {
                return dep.subscribe({
                    next: () => ReactiveNode.scheduleUpdate(this),
                    closed: false
                });
            });
            this._dependencySubscriptions = subs;
            // Force an update (this may not trigger notify() if the value is unchanged).
            ReactiveNode.scheduleUpdate(this);
        }

        this.subscribers.add(observer);
        const capturedValue = this.value;

        // Always schedule an immediate microtask to deliver the current value.
        queueMicrotask(() => {
            if (!observer.closed) {
                if (this._completed) {
                    if (typeof observer.complete === "function") {
                        observer.complete();
                    }
                    observer.closed = true;
                } else if (this._error !== undefined && typeof observer.error === "function" && !observer.errorNotified) {
                    observer.error(this._error);
                    observer.errorNotified = true;
                    observer.closed = true;
                } else if (observer.lastEmitted === undefined) {
                    observer.next(capturedValue);
                    observer.lastEmitted = capturedValue;
                }
            }
        });

        return () => {
            observer.closed = true;
            this.removeSubscriber(observer);
        };
    }

    /**
     * Helper method for skip subscriptions.
     * Subscriptions via skip do not emit the initial value.
     * @param {function|{next: function(any): void}} observer
     * @returns {function} Unsubscribe function.
     */
    skipSubscribe(observer) {
        if (typeof observer === "function") {
            observer = {next: observer, closed: false, lastEmitted: this.value};
        } else {
            observer.closed = false;
            observer.lastEmitted = this.value;
        }
        this.subscribers.add(observer);
        return () => {
            observer.closed = true;
            this.removeSubscriber(observer);
        };
    }

    /**
     * Getter for skip subscriptions.
     * Usage: node.skip.subscribe(observer);
     */
    get skip() {
        return {
            subscribe: (observer) => this.skipSubscribe(observer)
        };
    }

    /**
     * Subscribes an observer that is automatically unsubscribed after the first emission.
     * @param {function|{next: function(any): void, error?: function(any): void, complete?: function()}} observer
     * @returns {function} Unsubscribe function.
     */
    subscribeOnce(observer) {
        let unsub;
        const wrappedObserver =
            typeof observer === "function"
                ? {
                    next: (value) => {
                        unsub();
                        observer(value);
                    },
                    error: (err) => {
                        unsub();
                        if (typeof observer.error === "function") observer.error(err);
                    },
                    complete: () => {
                        unsub();
                        if (typeof observer.complete === "function") observer.complete();
                    },
                    closed: false,
                    lastEmitted: undefined,
                }
                : {
                    ...observer,
                    next: (value) => {
                        unsub();
                        observer.next(value);
                    },
                    closed: false,
                    lastEmitted: undefined,
                };
        unsub = this.subscribe(wrappedObserver);
        return unsub;
    }

    /**
     * Removes a subscriber from the node.
     * Also automatically cleans up dependency subscriptions for computed nodes if no subscribers remain.
     * @param {{next: function(any): void, closed: boolean}} observer
     */
    removeSubscriber(observer) {
        this.subscribers.delete(observer);
        if (this.fn && this.subscribers.size === 0 && this._dependencySubscriptions && this._dependencySubscriptions.length > 0) {
            this._dependencySubscriptions.forEach((unsub) => unsub());
            this._dependencySubscriptions = [];
        }
    }

    /**
     * Notifies all subscribers of a value change.
     * Notifications are scheduled asynchronously.
     */
    notify() {
        this.subscribers.forEach((subscriber) => {
            queueMicrotask(() => {
                if (!subscriber.closed && subscriber.lastEmitted !== this.value) {
                    subscriber.next(this.value);
                    subscriber.lastEmitted = this.value;
                }
            });
        });
    }

    /**
     * Notifies subscribers of an error.
     * @param {any} err - The error to notify.
     */
    notifyError(err) {
        this._error = err;
        this.subscribers.forEach((subscriber) => {
            queueMicrotask(() => {
                if (!subscriber.closed && typeof subscriber.error === "function" && !subscriber.errorNotified) {
                    subscriber.error(err);
                    subscriber.errorNotified = true;
                    subscriber.closed = true;
                }
            });
        });
    }


    /**
     * Externally notifies subscribers of an error.
     * @param {any} err - The error.
     */
    error(err) {
        this.notifyError(err);
    }

    /**
     * Completes the node, notifying subscribers that no further values will be emitted.
     */
    complete() {
        this._completed = true;
        this.subscribers.forEach((subscriber) => {
            queueMicrotask(() => {
                if (!subscriber.closed && typeof subscriber.complete === "function") {
                    subscriber.complete();
                }
                subscriber.closed = true;
            });
        });
        this.subscribers.clear();
        if (this.fn && this._dependencySubscriptions && this._dependencySubscriptions.length > 0) {
            this._dependencySubscriptions.forEach((unsub) => unsub());
            this._dependencySubscriptions = [];
        }
    }
}

export {ReactiveNode};
