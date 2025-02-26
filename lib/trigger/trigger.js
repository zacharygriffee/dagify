import {createNode} from "../node/index.js";
import {isPlainObject} from "../util/IsPlainObject.js";
import {finalize} from "rxjs";

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

    const count = createNode(0, {disableBatching: config.disableBatching ?? true});
    const subscriptions = []; // Track subscriptions for cleanup

    // Normalize sources and listen for updates
    const _sources = isPlainObject(sources) ? Object.values(sources) : [sources].flat();
    _sources.forEach(source => {
        if (source?.isDagifyNode || !source.subscribe) {
            throw new Error("trigger() sources must have a subscribe method and cannot be a ReactiveNode.");
        }

        // Subscribe and track cleanup
        // if the triggering dependency completes,
        // complete the trigger.
        const sub = source.subscribe({
            next() {
                count.update(prev => prev + 1); // Increment safely
            }
        });
        subscriptions.push(sub);
    });

    function cleanup() {
        subscriptions.forEach(sub => sub.unsubscribe());
        subscriptions.length = 0; // Clear array
        count.set(0);
    }

    count.subscribe({
        complete: cleanup // Cleanup on node completion
    });

    return createNode(([n]) => n, [count], {
        skip: 1,
        disableBatching: config.disableBatching ?? true,
        onCleanup: cleanup
    });
};

export {trigger};