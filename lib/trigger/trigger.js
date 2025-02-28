import { createNode } from "../node/index.js";
import { isPlainObject } from "../util/IsPlainObject.js";
import { ensureShared } from "../rxjs/ensureShared.js";
import { finalize, tap } from "rxjs";

/**
 * Wraps one or multiple **event-based sources** in a trigger node, ensuring that
 * any updates (even with the same value) force recomputation.
 *
 * 🚨 **IMPORTANT:** `trigger()` should only be used with **RxJS Observables** or other event emitters.
 * **It should NOT wrap `ReactiveNode` instances.**
 *
 * @param {Observable | Observable[] | Record<string, Observable>} sources
 *        A single RxJS `Observable`, an array of `Observables`, or an object mapping keys to `Observables`.
 * @param {Object} [config={}] Configuration options.
 * @param {boolean} [config.disableBatching=true] Whether to disable batching for immediate updates.
 * @returns {ReactiveNode} A node that emits an incrementing value on each event.
 *
 * @throws {Error} If a `ReactiveNode` is provided as a trigger.
 */
const trigger = (sources, config = {}) => {
    if (!sources || typeof sources !== "object") {
        throw new Error("trigger() requires an RxJS Observable, an array of Observables, or an object of Observables.");
    }

    // Create a node to track the count (which increments on every event).
    const count = createNode(0, { disableBatching: config.disableBatching ?? true });
    const subscriptions = []; // Track subscriptions for cleanup

    // Internal helper to subscribe to the shared sources.
    const _subscribeToSources = () => {
        const _sources = isPlainObject(sources) ? Object.values(sources) : [sources].flat();
        _sources.forEach(source => {
            if (source?.isDagifyNode || !source.subscribe) {
                throw new Error("trigger() sources must have a subscribe method and cannot be a ReactiveNode.");
            }
            const sharedSource = ensureShared(source);
            // Subscribe and track cleanup.
            const sub = sharedSource.subscribe({
                next() {
                    count.update(prev => prev + 1); // Increment safely on each event.
                }
            });
            subscriptions.push(sub);
        });
    };

    // Initially subscribe.
    _subscribeToSources();

    // Cleanup function to remove all subscriptions and reset the count.
    function cleanup() {
        subscriptions.forEach(sub => sub.unsubscribe());
        subscriptions.length = 0; // Clear array
        // Reset the node's internal state.
        node._skip = 1;
        count.set(0);
    }

    // When the count node completes, clean up.
    count.subscribe({
        complete: cleanup
    });

    // Create and return a trigger node.
    // We add an onSubscribe hook to reestablish subscriptions if new subscribers arrive
    // after cleanup has been triggered.
    const node = createNode(([n]) => n, [count], {
        skip: 1,
        disableBatching: config.disableBatching ?? true,
        onCleanup: cleanup,
        onUnsubscribe: subscriberCount => {
            if (subscriberCount === 0) {
                cleanup();
            }
        },
        onSubscribe: subscriberCount => {
            // If the first subscriber is added and there are no active source subscriptions,
            // reset the count and re-subscribe so the trigger can recover.
            if (subscriberCount === 1 && subscriptions.length === 0) {
                // Reset the internal count to 0.
                node._skip = 1;
                count.set(0);
                _subscribeToSources();
            }
        }
    });
    return node;
};

export { trigger };
