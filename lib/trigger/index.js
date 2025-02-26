import { createNode } from "../node/index.js";
import { isRxObservable } from "../rxjs/isRxObservable.js";
import { Subject } from "rxjs";
import {isPlainObject} from "../util/IsPlainObject.js";
import {takeUntilCompleted} from "../operators/index.js";

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

    const count = createNode(0, { disableBatching: config.disableBatching ?? true });
    const subscriptions = []; // Track subscriptions for cleanup

    // Normalize sources and listen for updates
    const _sources = isPlainObject(sources) ? Object.values(sources) : [sources].flat();
    _sources.forEach(source => {
        if (source?.isDagifyNode || !source.subscribe) {
            throw new Error("trigger() sources must have a subscribe method.");
        }

        // Subscribe and track cleanup
        const sub = source.subscribe(() => {
            count.update(prev => prev + 1); // Increment safely
        });
        subscriptions.push(sub);
    });

    // Handle cleanup when the trigger node is unsubscribed or completed
    const cleanup = () => {
        subscriptions.forEach(sub => sub.unsubscribe());
        subscriptions.length = 0; // Clear array
    };

    count.subscribe({
        complete: cleanup, // Cleanup on node completion
        unsubscribe: cleanup, // Cleanup on manual unsubscribe
    });

    return createNode(([n]) => n, [count], { skip: 1, disableBatching: config.disableBatching ?? true });
};


/**
 * Creates a new **manually controlled** event-based trigger.
 *
 * Unlike `trigger()`, which wraps existing **event sources**,
 * `createTrigger()` **creates a fresh independent trigger** that can be externally controlled.
 *
 * @returns {Subject} A new RxJS Subject that can be used as a trigger.
 *
 * @example
 * // Create an independent trigger
 * const manualTrigger = createTrigger();
 *
 * // Wrap it in a reactive trigger node
 * const triggered = trigger(manualTrigger);
 *
 * // Subscribe to listen for changes
 * triggered.subscribe(value => console.log("Triggered:", value));
 *
 * // Manually emit updates
 * manualTrigger.next(); // Logs: "Triggered: 1"
 * manualTrigger.next(); // Logs: "Triggered: 2"
 */
const createTrigger = () => new Subject();

export { createTrigger, trigger };
