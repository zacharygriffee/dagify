# Dagify

Dagify is a lightweight functional-reactive programming (FRP) library for building reactive dependency graphs. It lets you create reactive nodes—both stateful and computed—that automatically propagate updates through a directed acyclic graph (DAG) of dependencies. Dagify is designed for modern JavaScript applications and works seamlessly with RxJS. In front-end projects, its nodes can also double as Svelte stores.

> **Note:**  
> - Use `createNode()` to create a **ReactiveNode**.  
> - Use `createGraph()` to create a **ReactiveGraph** for structured node management.  
> - Use `createComposite()` to combine multiple nodes into a single reactive composite.  
> - Additional helper functions like `batch()`, `fromObservable()`, `setIdGenerator()`, and `takeUntilCompleted()` enhance your workflow.

## Table of Contents

- [Installation](#installation)
- [API Reference](#api-reference)
  - [ReactiveNode API](#reactivenode-api)
  - [ReactiveGraph API](#reactivegraph-api)
  - [Composite Nodes](#composite-nodes)
  - [Helper Functions](#helper-functions)
- [Usage Examples](#usage-examples)
  - [Creating Stateful and Computed Nodes](#creating-stateful-and-computed-nodes)
  - [Managing a Reactive Graph](#managing-a-reactive-graph)
  - [Advanced Node Features](#advanced-node-features)
- [Contributing](#contributing)
- [License](#license)

## Installation

Install Dagify via npm:

```bash
npm install dagify
```

## API Reference

### ReactiveNode API

Create nodes using `createNode()`. A ReactiveNode supports both stateful (manual updates) and computed (derived) behavior.

**Key Methods:**

- **`set(value)`**  
  Sets a new value (for stateful nodes).

- **`update(fn)`**  
  Updates the node’s value by applying a function to the current value. For computed nodes, this triggers recomputation.

- **`subscribe(callback)`**  
  Subscribes to value changes.

- **`subscribeOnce(callback)`**  
  Subscribes to the next emission only; automatically unsubscribes afterward.

- **`skip`**  
  A subscription interface that skips the initial emission.

- **`once`**  
  A one-time subscription interface.

- **`toObservable()`**  
  Converts the node to an RxJS Observable.

- **`complete()`**  
  Marks the node as complete so that no further updates occur.

- **`addDependency(node | array)`** and **`removeDependency(node | array)`**  
  Manage dependencies for computed nodes in bulk.

> **Svelte Compatibility:**  
> Dagify nodes follow a similar API to Svelte stores, so they can be used directly in Svelte applications for reactive state management.

Example:

```js
import { createNode } from "dagify";

const stateful = createNode(1);
stateful.subscribe(val => console.log("Stateful:", val));
stateful.set(2);
stateful.update(current => current + 1);
```

### ReactiveGraph API

Create a graph using `createGraph()`. The ReactiveGraph organizes nodes, prevents cycles, and provides extensive introspection.

**Key Methods:**

- **`addNode(node)` or `addNode(id, node)`**  
  Adds a node to the graph. If an id is provided, that key is used; otherwise, the node’s generated id is used.

- **`removeNode(nodeRef)`**  
  Removes a node and all its connections.

- **`connect(srcRef, tgtRef)`**  
  Adds an edge from the source node to the target node (with automatic cycle prevention).

- **`disconnect(srcRef, tgtRef)`**  
  Removes the edge from source to target.

- **`topologicalSort()`**  
  Returns a topologically sorted array of node keys.

- **`update()`**  
  Recomputes all computed nodes in topological order.

- **`updateAsync()`**  
  Asynchronously updates all computed nodes.

- **`getNode(ref | array)`**  
  Retrieves a node (or an array of nodes) by reference.

- **`getImmediatePredecessors(ref)`**  
  Gets the direct dependency nodes of a given node.

- **`getPredecessors(ref, { transitive: true })`**  
  Gets all (transitive) dependency nodes.

- **`getImmediateSuccessors(ref)`**  
  Gets the nodes that depend directly on a given node.

- **`getSuccessors(ref, { transitive: true })`**  
  Gets all (transitive) dependent nodes.

- **`getSources()`**  
  Retrieves all nodes with no incoming edges.

- **`getSinks()`**  
  Retrieves all nodes with no outgoing edges.

- **`toString()`**  
  Returns a human-readable string representation of the graph.

- **`findPath(srcRef, tgtRef)`**  
  Finds a dependency path (an array of Buffer keys) from the source to the target node.

- **`getInDegree(ref)`** / **`getOutDegree(ref)`**  
  Returns the number of incoming or outgoing edges for a node.

- **`hasNode(ref)`**  
  Checks if the node exists in the graph.

- **`hasEdge(srcRef, tgtRef)`**  
  Checks if an edge exists from the source to the target node.

- **`clear()`**  
  Removes all nodes and edges from the graph.

- **`getConnectedComponent(ref)`**  
  Retrieves all nodes in the same connected component as the given node.

Example:

```js
import { createGraph, createNode } from "dagify";

const graph = createGraph();

const a = createNode(1);
const b = createNode(2);
const sum = createNode(([x, y]) => x + y);

graph.addNode(a);
graph.addNode(b);
graph.addNode(sum);

graph.connect(a, sum);
graph.connect(b, sum);

sum.subscribe(val => console.log("Sum:", val)); // Initially logs "Sum: 3"
a.set(3); // Logs "Sum: 5"
b.set(4); // Logs "Sum: 7"
```

### Composite Nodes

Use `createComposite()` to aggregate multiple reactive nodes into a single composite node that emits a combined value. Composites can be created in two modes:

- **Array Mode:** Combine an array of nodes.
- **Object Mode:** Combine an object of nodes.

Example (Array Mode):

```js
import { createNode, createComposite } from "dagify";

const node1 = createNode(1);
const node2 = createNode(2);
const composite = createComposite([node1, node2]);

composite.subscribe(values => {
  console.log("Composite (array mode):", values);
});

node1.set(10); // Logs: [10, 2]
node2.set(20); // Logs: [10, 20]
```

Example (Object Mode):

```js
import { createNode, createComposite } from "dagify";

const nodeA = createNode(1);
const nodeB = createNode(2);
const composite = createComposite({ a: nodeA, b: nodeB });

composite.subscribe(values => {
  console.log("Composite (object mode):", values);
});

nodeA.set(10); // Logs: { a: 10, b: 2 }
nodeB.set(20); // Logs: { a: 10, b: 20 }
```

### Helper Functions

Dagify exports several helper functions that enhance your development experience:

- **`setIdGenerator(fn)`**  
  Customize the format of node identifiers. For example:

  ```js
  import { setIdGenerator } from "dagify";

  setIdGenerator(() => `CustomNode-${Date.now()}`);
  ```

- **`fromObservable(observable)`**  
  Converts an RxJS Observable into a reactive node. This is useful when you want to integrate external streams into your reactive graph.

  ```js
  import { fromObservable } from "dagify";
  import { interval } from "rxjs";

  const obsNode = fromObservable(interval(1000));
  obsNode.subscribe(val => console.log("Observable node:", val));
  ```

- **`batch(fn)`**  
  Executes multiple updates in batch mode, so subscribers receive only the final value.

  ```js
  import { createNode, batch } from "dagify";

  const value = createNode(0);
  value.subscribe(val => console.log("Batched value:", val));

  batch(() => {
    value.set(1);
    value.set(2);
    value.set(3);
  });
  // Subscribers only see the final value: 3.
  ```

- **`takeUntilCompleted()`**  
  A custom RxJS operator that completes a stream when a notifier (e.g., a node) completes.

  ```js
  import { takeUntilCompleted } from "dagify";
  import { interval, Subject } from "rxjs";

  const stopNotifier = new Subject();
  const source = interval(1000).pipe(takeUntilCompleted(stopNotifier));

  source.subscribe({
    next: val => console.log("Tick:", val),
    complete: () => console.log("Source completed")
  });

  setTimeout(() => stopNotifier.complete(), 5000);
  ```

## Usage Examples

### Creating Stateful and Computed Nodes

#### Stateful Node

```js
import { createNode } from "dagify";

const count = createNode(1);
count.subscribe(val => console.log("Count:", val));
count.set(5); // Updates count to 5.
```

#### Computed Node

```js
import { createNode } from "dagify";

const count = createNode(1);
const double = createNode(([val]) => val * 2, [count]);

double.subscribe(val => console.log("Double:", val));
count.set(3); // Automatically logs "Double: 6"
```

#### Asynchronous Computed Node

```js
import { createNode } from "dagify";

const count = createNode(1);
const asyncDouble = createNode(([val]) => {
  return new Promise(resolve => setTimeout(() => resolve(val * 2), 50));
}, [count]);

asyncDouble.subscribe(val => console.log("Async double:", val));
count.set(4); // Eventually logs "Async double: 8"
```

### Managing a Reactive Graph

```js
import { createGraph, createNode } from "dagify";

const graph = createGraph();

const a = createNode(1);
const b = createNode(2);
const sum = createNode(([x, y]) => x + y);

graph.addNode(a);
graph.addNode(b);
graph.addNode(sum);

graph.connect(a, sum);
graph.connect(b, sum);

sum.subscribe(val => console.log("Sum:", val));

a.set(3); // Logs "Sum: 5"
b.set(4); // Logs "Sum: 7"

// Print the graph:
console.log("Graph:\n" + graph.toString());

// Find a dependency path from a to sum:
const path = graph.findPath(a, sum);
console.log("Path from a to sum:", path.map(buf => graph.decodeKey(buf)));

// Get immediate predecessors and the connected component:
console.log("Immediate predecessors of sum:", graph.getImmediatePredecessors(sum).map(n => n.id));
console.log("Connected component for a:", graph.getConnectedComponent(a).map(n => n.id));
```

### Advanced Node Features

#### Batched Updates

```js
import { createNode, batch } from "dagify";

const value = createNode(0);
value.subscribe(val => console.log("Batched value:", val));

batch(() => {
  value.set(1);
  value.set(2);
  value.set(3);
});
// Subscribers receive only the final value: 3.
```

#### Skip Initial Emission

```js
import { createNode } from "dagify";

const node = createNode(10);
node.skip.subscribe(val => console.log("Skip subscription:", val));
node.set(20); // Logs: "Skip subscription: 20" (no initial emission of 10)
```

#### Once Subscriptions

```js
import { createNode } from "dagify";

const node = createNode(0);
node.subscribeOnce(val => console.log("subscribeOnce:", val));
node.once.subscribe(val => console.log("once subscription:", val));
node.set(1); // Each logs only once.
```

#### Asynchronous Graph Update

```js
import { createGraph, createNode } from "dagify";

const graph = createGraph();

const a = createNode(3);
const b = createNode(([val]) => val * 2);
// Override update() to simulate an async computation.
b.update = async function() {
  this.value = this.fn([a.value]);
  await new Promise(resolve => setTimeout(resolve, 10));
};

graph.addNode(a);
graph.addNode(b);
graph.connect(a, b);

await graph.updateAsync();
console.log("Async update - b.value:", b.value); // Should log 6.
```

#### Composite Aggregation

```js
import { createNode, createComposite } from "dagify";

const node1 = createNode(1);
const node2 = createNode(2);
const composite = createComposite([node1, node2]);

composite.subscribe(values => console.log("Composite (array mode):", values));

node1.set(10); // Logs: [10, 2]
node2.set(20); // Logs: [10, 20]
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for improvements, bug fixes, or new features.

## License

This project is licensed under the [MIT License](LICENSE).