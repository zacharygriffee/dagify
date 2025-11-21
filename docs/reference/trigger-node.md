# Trigger Node Documentation

## Overview
The `trigger` function wraps **event-based sources** (such as RxJS Observables) to ensure that **any updates, even if the emitted value is the same, trigger a recomputation**. This is useful for cases where an event does not supply a meaningful value but should still notify dependent computations.

🚨 **Important:** The `trigger` function should **only** be used with **RxJS Observables** or other event-based sources. It **should NOT** wrap `ReactiveNode` instances.

## API Reference

### `trigger(sources, config)`

#### Parameters:
- **`sources`** *(Observable | Observable[] | Record<string, Observable>)*:
  - A single RxJS `Observable`,
  - An array of `Observables`, or
  - An object mapping keys to `Observables`.
- **`config`** *(Object, optional)*:
  - `{ disableBatching: boolean }` *(default: `true`)*: Disables batching so updates happen immediately.

#### Returns:
- **`ReactiveNode`** – A node that emits an incrementing value on each event emission.

#### Throws:
- If a `ReactiveNode` is passed as a source.
- If an invalid input type is given (e.g., a number or string).

#### Example Usage

##### 1️⃣ Wrapping a DOM Event Listener (`fromEvent`)
```js
import { trigger } from "dagify";
import { fromEvent } from "rxjs";

const click$ = fromEvent(document, "click");
const triggeredClick = trigger(click$);

triggeredClick.subscribe(value => console.log("Click Triggered:", value));
// Every click logs: "Click Triggered: 1", "Click Triggered: 2", ...
```

##### 2️⃣ Using `trigger()` in a Computed Node
```js
import { trigger, createNode } from "dagify";
import { fromEvent } from "rxjs";

const click$ = fromEvent(document, "click");
const triggerClick = trigger(click$);

let message = "hello";
const updateMessage = createNode(() => message, [triggerClick]);
const someDep = createNode(x => console.log(x), updateMessage);

// Each click will cause `updateMessage` to recompute and `someDep` to log the latest value.
```

##### 3️⃣ Wrapping Multiple Observables (`interval`, `fromEvent`)
```js
import { trigger } from "dagify";
import { interval, fromEvent } from "rxjs";

const timer$ = interval(1000);
const event$ = fromEvent(document, "keydown");

const triggeredEvents = trigger([timer$, event$]);

triggeredEvents.subscribe(value => console.log("Triggered Event:", value));
// Every second logs: "Triggered Event: 1", "Triggered Event: 2", ...
// Every keydown logs: "Triggered Event: 3", ...
```

##### 4️⃣ Ensuring Proper Cleanup (Prevent Memory Leaks)
```js
import { trigger } from "dagify";
import { interval } from "rxjs";

const timer$ = interval(500).pipe(take(3));
const triggeredTimer = trigger(timer$);

const sub = triggeredTimer.subscribe(value => console.log("Timer Triggered:", value));

setTimeout(() => {
  sub.unsubscribe();
  console.log("Timer stopped.");
}, 5000);
```

## `createTrigger()` – Manual Event-Based Trigger
### API
#### Returns:
- **`Subject`** – A new RxJS `Subject` that can be used as a trigger.

#### Example Usage:
```js
import { createTrigger, trigger } from "dagify";

const manualTrigger = createTrigger();
const triggered = trigger(manualTrigger);

triggered.subscribe(value => console.log("Manual Triggered:", value));

manualTrigger.next(); // Logs: "Manual Triggered: 1"
manualTrigger.next(); // Logs: "Manual Triggered: 2"
```

## Best Practices
✅ **Use `fromEvent`, `interval`, or any RxJS Observable that does not hold state.**
✅ **Manually unsubscribe from long-lived event sources.**
✅ **Use `createTrigger()` if you need to trigger updates manually.**
✅ **Ensure that the `trigger()` function is only used with event-based sources.**

## Error Handling
| Error | Cause | Resolution |
|-------|-------|------------|
| `trigger() cannot wrap a ReactiveNode.` | A `ReactiveNode` was passed instead of an Observable. | Use `createTrigger()` if you need manual event control. |
| `trigger() requires an RxJS Observable, an array of Observables, or an object of Observables.` | Invalid input type was provided. | Ensure the input is a valid RxJS Observable. |
| `Only RxJS Observables can be used with trigger().` | A non-observable was used. | Convert your event source to an Observable before passing it. |

## Summary
- The `trigger` function wraps **event-driven sources** and forces updates when they emit.
- It **should not** be used with `ReactiveNode`, but instead with RxJS Observables.
- `createTrigger()` allows manual event triggering via an `RxJS Subject`.
- Proper **subscription cleanup** is required for long-lived observables.

