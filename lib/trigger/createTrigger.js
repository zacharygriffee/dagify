import {Subject} from "rxjs";

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
export {createTrigger};