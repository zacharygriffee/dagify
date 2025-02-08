# Dagify

Dagify is a lightweight, functional-reactive programming (FRP) library that allows you to create reactive nodes—both stateful and computed—that automatically propagate changes through a directed acyclic graph (DAG) of dependencies. It provides RxJS-compatible APIs along with features like batched updates, error handling, completion, and flexible subscription options.

## Features

- **Stateful Nodes:** Create nodes that hold a value and can be updated manually.
- **Computed Nodes:** Derive new nodes from one or more dependencies that automatically recompute when any dependency changes.
- **Reactive Graph Support:** Organize nodes into a `ReactiveGraph` for structured dependency management.
- **RxJS Observable Integration:** Observables passed as dependencies are automatically converted into reactive nodes.
- **Batched Updates:** Group multiple updates together so that subscribers receive only the final value.
- **Skip Subscriptions:** Option to subscribe without receiving an initial value.
- **Error Handling:** Computed nodes propagate errors via an `error` callback.
- **Completion:** Nodes can be marked complete so that no further updates are emitted.
- **Once Subscriptions:** Subscribe once and automatically unsubscribe after the first emission.
- **Automatic Dependency Cleanup:** Computed nodes automatically clean up their dependency subscriptions when there are no active subscribers and reinitialize them when needed.
- **Cycle Prevention:** The `ReactiveGraph` class ensures that adding edges between nodes does not create cycles.
- **RxJS Compatibility:** Built on a Subject-like API for seamless interoperability.
- **Custom RxJS Operator:** `takeUntilCompleted()` operator allows observables to complete when another observable completes.

## Installation

Install Dagify via npm:

```bash
npm install dagify
```

## Usage

### Creating a Stateful Node

```js
import { createNode } from "dagify";

const count = createNode(1);
count.subscribe(value => console.log("Count:", value));
count.set(5); // Logs: "Count: 5"
```

### Creating a Computed Node

```js
import { createNode } from "dagify";

const count = createNode(1);
const double = createNode(
  ([countValue]) => countValue * 2,
  [count]
);

double.subscribe(value => console.log("Double:", value));
// Changing count updates double automatically:
count.set(5); // Logs: "Double: 10"
```

### Creating a Reactive Graph

Dagify supports managing nodes in a structured manner using `ReactiveGraph`. This allows you to track node dependencies and prevent cycles.

```js
import { createGraph, createNode } from "dagify";

const graph = createGraph();
const a = createNode(1);
const b = createNode(2);
const sum = createNode(([x, y]) => x + y, [a, b]);

graph.addNode("a", a);
graph.addNode("b", b);
graph.addNode("sum", sum);
graph.connect("a", "sum");
graph.connect("b", "sum");

sum.subscribe(value => console.log("Sum:", value));

a.set(3); // Logs: "Sum: 5"
b.set(4); // Logs: "Sum: 7"
```

### Using Observables in Dagify

Dagify allows seamless interoperability with RxJS observables. If an observable is passed as a dependency, it is automatically converted into a reactive node.

If an initial value is needed, the RxJS `startsWith` operator can be used instead of `fromObservable`:

```js
import { createNode } from "dagify";
import { interval, startWith } from "rxjs";

const obs = interval(1000).pipe(startWith(0));
const node = createNode(obs);

node.subscribe(value => console.log("Tick:", value));
```

Using `fromObservable` explicitly is unnecessary unless an initial value is required and `startsWith` is not an option.

### Batched Updates

You can batch multiple updates together so that subscribers receive only the final value:

```js
import { createNode, batch } from "dagify";

const value = createNode(0);
batch(() => {
  value.set(1);
  value.set(2);
  value.set(3);
});
// Subscribers only see the final value, 3.
```

### Skip Initial Emission

Use the `skip` interface to subscribe without receiving the initial emission:

```js
import { createNode } from "dagify";

const node = createNode(10);
node.skip.subscribe(value => {
  console.log("Updated value:", value);
});
node.set(20); // Logs: "Updated value: 20"
// No initial emission of 10 is delivered.
```

### Error Handling and Completion

Computed nodes propagate errors if their computation fails, and you can complete a node to signal that no further updates will be sent.

```js
import { createNode } from "dagify";

// Computed node that throws an error
const faulty = createNode(([a]) => {
  throw new Error("Computation failed");
}, [createNode(5)]);

faulty.subscribe({
  next: () => console.log("Should not receive a value"),
  error: (err) => console.error("Error:", err.message)
});

// Marking a node as complete:
const node = createNode(100);
node.subscribe({
  next: (value) => console.log("Value:", value),
  complete: () => console.log("Node completed")
});
node.complete();
node.set(200); // No further updates emitted.
```

### Once Subscriptions

Dagify supports one-time subscriptions via two interfaces: `subscribeOnce` and the `once` property. Both will automatically unsubscribe after the first emission.

Using `subscribeOnce`:

```js
import { createNode } from "dagify";

const node = createNode(0);
node.subscribeOnce(value => console.log("Once:", value));
node.set(1); // Logs "Once: 1"
// Subsequent updates will not trigger the once subscriber.
```

Or using the `once` subscription interface:

```js
import { createNode } from "dagify";

const node = createNode(0);
node.once.subscribe(value => console.log("Once (via once):", value));
node.set(1); // Logs "Once (via once): 1"
```

### Custom RxJS Operator: `takeUntilCompleted`

Dagify provides a custom operator to complete a source observable when another observable completes.

```js
import { takeUntilCompleted } from "dagify";
import { interval, Subject } from "rxjs";

const stopNotifier = new Subject();
const source = interval(1000).pipe(takeUntilCompleted(stopNotifier));

source.subscribe({
  next: (value) => console.log("Tick:", value),
  complete: () => console.log("Stopped"),
});

setTimeout(() => stopNotifier.complete(), 5000);
// After 5 seconds, the observable stops.
```

## License

This project is licensed under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements, bug fixes, or new features.

## Acknowledgments

Dagify was inspired by functional reactive programming libraries like RxJS while maintaining a lean and minimal API suitable for modern JavaScript applications.

