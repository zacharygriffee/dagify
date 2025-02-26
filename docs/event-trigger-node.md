# triggerFromEvent Documentation

The `triggerFromEvent` function is designed to wrap an event-based source into a trigger node. This allows you to convert events from either a Node.js-style `EventEmitter` or a DOM `EventTarget` into a reactive stream. **Note:** This function does **not** emit the actual event data; instead, it emits an incrementing counter value each time the event occurs.

---

## Function Signature

```js
triggerFromEvent(source: EventEmitter | EventTarget, eventName: string, config?: Object) => ReactiveNode
```

---

## Parameters

- **source**:  
  The event source to be wrapped. This must be either:
    - A Node.js `EventEmitter` (or any object with a similar interface), or
    - A DOM `EventTarget` (or any object implementing `addEventListener`/`removeEventListener`).

- **eventName**:  
  A string representing the name of the event to listen for on the provided source.

- **config** (optional):  
  An object containing configuration options to be passed to the underlying trigger node. In addition to any trigger-specific settings, it supports:
    - **onCleanup**: A callback function that is invoked when the last subscriber unsubscribes from the node. This can be used to perform any cleanup actions, such as tearing down resources or removing event listeners.

---

## Returns

- **ReactiveNode**:  
  A reactive node that emits an incrementing value on each occurrence of the specified event.  
  **Important:** The node does **not** emit any data from the event itself; it simply updates an internal counter.

---

## Description

`triggerFromEvent` leverages the RxJS `fromEvent` function to convert events emitted by the source into an observable stream. This observable is then wrapped by the `trigger()` function to create a reactive node. Each time the specified event fires, the node's internal counter is incremented. This means that, regardless of the actual event data, the node emits a new numerical value (typically incremented by one), signaling that an event has occurred.

The function first checks that the source is a valid event emitter or event target. If the source does not meet these criteria, it throws an error.

---

## Usage Example

```js
import { triggerFromEvent } from './triggerFromEvent.js';

// Example with a DOM EventTarget:
const button = document.getElementById('myButton');
const triggerNode = triggerFromEvent(button, 'click', {
  onCleanup: () => {
    console.log('All subscribers have unsubscribed; cleanup performed.');
  }
});

// Subscribe to the trigger node
const subscription = triggerNode.subscribe(value => {
  console.log('Button clicked, trigger value:', value);
});

// When the button is clicked, the node emits an incrementing value (e.g., 1, 2, 3, ...),
// not the click event's data.

// Later, when you want to remove the subscription:
subscription.unsubscribe();
// When the last subscriber unsubscribes, onCleanup is automatically invoked.
```

---

## Additional Notes

- **Event Data:**  
  **This function does not emit the event's data.** Instead, it signals event occurrences by emitting an incrementing counter. Use this approach when you only need to know that an event happened, not the specifics of the event.

- **Event Names:**  
  Ensure that the event name provided matches the event dispatched by your source.

- **onCleanup Callback:**  
  The `onCleanup` callback is triggered only when the subscriber count drops to zero. This callback is ideal for releasing resources, such as removing event listeners.

- **Integration with ReactiveNode:**  
  This function is useful for integrating external event sources into a reactive programming model. It abstracts away the details of event management, allowing you to focus on handling event occurrences in a declarative manner.

---

By using `triggerFromEvent`, you can easily incorporate external event sources into your reactive system while ensuring that only an occurrence signal (in the form of an incrementing value) is emitted, without passing along the event data itself.