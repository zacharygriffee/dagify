# Dagify

[![npm version](https://img.shields.io/npm/v/dagify.svg)](https://www.npmjs.com/package/dagify)
[![Build Status](https://img.shields.io/travis/yourusername/dagify.svg)](https://travis-ci.org/yourusername/dagify)
[![License](https://img.shields.io/npm/l/dagify.svg)](LICENSE)

Dagify is a lightweight, functional-reactive programming (FRP) library that allows you to create reactive nodes—both stateful and computed—that automatically propagate changes through a directed acyclic graph (DAG) of dependencies. It provides RxJS-compatible APIs along with features like batched updates, error handling, completion, and flexible subscription options.

## Features

- **Stateful Nodes:** Create nodes that hold a value and can be updated manually.
- **Computed Nodes:** Derive new nodes from one or more dependencies that automatically recompute when any dependency changes.
- **Batched Updates:** Group multiple updates together so that subscribers receive only the final value.
- **Skip Subscriptions:** Option to subscribe without receiving an initial value.
- **Error Handling:** Computed nodes propagate errors via an `error` callback.
- **Completion:** Nodes can be marked complete so that no further updates are emitted.
- **Once Subscriptions:** Subscribe once and automatically unsubscribe after the first emission.
- **Automatic Dependency Cleanup:** Computed nodes clean up their dependency subscriptions when there are no active subscribers, and reinitialize them when needed.
- **RxJS Compatibility:** Built on a Subject-like API for interoperability.

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

Subscribe once to automatically unsubscribe after the first update:

```js
import { createNode } from "dagify";

const node = createNode(0);
node.subscribeOnce(value => console.log("Once:", value));
node.set(1); // Logs "Once: 1"
// Subsequent updates will not trigger the once subscriber.
```

## API

### `createNode(fnOrValue, dependencies)`

- **Parameters:**
    - `fnOrValue` (function | any): Either a function for computed nodes or an initial value.
    - `dependencies` (array, optional): An array of nodes on which the computed node depends.
- **Returns:** A new reactive node.

### `batch(fn)`

- **Parameters:**
    - `fn` (function): A function containing multiple updates.
- **Description:** Executes multiple updates in batch mode so that subscribers only see the final computed value.

### Subscription Methods

- **subscribe(observer):**  
  Subscribes to changes. The observer can be a function or an object with `next`, `error`, and `complete` callbacks. The initial value is emitted asynchronously.

- **skip.subscribe(observer):**  
  Works like `subscribe` but skips the initial emission.

- **subscribeOnce(observer):**  
  Subscribes to the node and automatically unsubscribes after the first emission.

- **error(err):**  
  Manually triggers error notifications for the node.

- **complete():**  
  Marks the node as complete, triggers completion notifications, and stops further emissions.

## License

This project is licensed under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements, bug fixes, or new features.

## Acknowledgments

Dagify was inspired by functional reactive programming libraries like RxJS while maintaining a lean and minimal API suitable for modern JavaScript applications.
