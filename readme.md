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
- [Recent Commit](#recent-commit)

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

**Creating Nodes:**

Nodes are created with the `createNode()` function. For example:

```js
const node1 = createNode(5); // A stateful node with an initial value of 5.
const node2 = createNode(([n]) => n + 4, [node1]); // A computed node that depends on node1 (node2.value becomes 9).
```

**Adding Nodes to the Graph:**

Nodes are added to the graph using either the single or batch methods:

- **`addNode(node)` or `addNode(id, node)`**  
  Adds a single node to the graph.
  - When called with one argument, the node’s internally generated identifier is used.
  - When called with two arguments, the first argument is treated as a custom identifier and the provided node is associated with that key.

  **Examples:**
  ```js
  // Using the node’s generated id:
  graph.addNode(node1);
  
  // Using a custom id:
  graph.addNode("five", node1);
  ```

- **`addNodes(nodes)`**  
  Adds multiple nodes to the graph in one call. Each element in the provided array can be one of two formats:

  1. **Node Object:**  
     Simply supply the node object. The node’s generated id is used.
     ```js
     graph.addNodes([node1, node2]);
     ```

  2. **Tuple Format:**  
     Supply a two-element array where the first element is a custom identifier and the second element is the node object.
     ```js
     graph.addNodes([
       ["five", node1],
       ["nine", node2]
     ]);
     ```

- **`upsertNode(node)` or `upsertNode(id, node)`**  
  Retrieves an existing node or adds a new one if it does not exist. This method supports both a full dagify node object (with an auto-generated id) and a tuple format (custom id plus node).

  **Example:**
  ```js
  // Using the node’s generated id:
  const nodeA = createNode(1);
  const a = graph.upsertNode(nodeA);

  // Using a custom id:
  const nodeB = createNode(2);
  const b = graph.upsertNode("two", nodeB);
  ```

---

### Node Factory API

The `nodeFactory` function provides a convenient, lazy mechanism to create and manage nodes on-demand. It returns a proxy that:

- **Lazily creates nodes:**  
  When a property is accessed on the factory, it calls `createNode(value, deps)` to create a new node and caches it.
  - For **computed nodes** (when `value` is a function), the supplied dependencies (`deps`) are applied.
  - For **non-computed nodes** (when `value` is not a function), dependencies are ignored.

- **Supports iteration:**  
  The proxy implements the iterator protocol, yielding sequentially created nodes (up to a maximum specified by the `max` parameter).
  > **Note:** Exceeding the maximum number of nodes (default is 1000) throws an error.

- **Provides a clear method:**  
  The factory exposes a `clear()` method that deletes all cached nodes. For each deleted node, if it has a `complete()` method, that method is invoked before removal.

**Example Usage:**

```js
import { nodeFactory } from "dagify";

// For computed nodes (with dependencies):
const computedFactory = nodeFactory(
  (deps) => deps.reduce((sum, node) => sum + node.value, 0),
  [dep1, dep2]
);
const computedNode = computedFactory.someKey;
console.log("Computed node value:", computedNode.value);

// For non-computed (static) nodes, dependencies are ignored:
const staticFactory = nodeFactory(42, [dep1, dep2]);
const staticNode = staticFactory.someKey;
console.log("Static node value:", staticNode.value);

// Iterating over nodes:
for (const node of computedFactory) {
  console.log("Iterated node:", node);
  break; // Remember to break to avoid infinite iteration
}

// Clearing all nodes:
computedFactory.clear();
```
**Other Key Methods:**

- **`removeNode(nodeRef)`**  
  Removes a node and all its connections.

- **`connect(srcRef, tgtRef)`**  
  Adds an edge from the source node to the target node (with automatic cycle prevention). This method is overloaded so that either parameter may be a single node (or node id) or an array of nodes. Every source node is connected to every target node.

  **Examples:**
  ```js
  // Connect a single node to a single node:
  graph.connect(node1, node2);

  // Connect a single node to multiple nodes:
  graph.connect(node1, [node2, node3]);

  // Connect multiple nodes to a single node:
  graph.connect([node1, node2], node3);

  // Connect multiple nodes to multiple nodes:
  graph.connect([node1, node2], [node3, node4]);
  ```

- **`disconnect(srcRef, tgtRef)`**  
  Removes the edge from the source to the target node. Like `connect`, this method is overloaded to support both single values and arrays for either parameter.

  **Examples:**
  ```js
  // Disconnect a single edge:
  graph.disconnect(node1, node2);

  // Disconnect one node from multiple targets:
  graph.disconnect(node1, [node2, node3]);

  // Disconnect multiple nodes from one target:
  graph.disconnect([node1, node2], node3);
  ```

- **`topologicalSort()`**  
  Returns an array of node keys sorted in topological order. Nodes with no incoming edges come first.

- **`update()`**  
  Recomputes all computed nodes in topological order.

- **`updateAsync()`**  
  Asynchronously updates all computed nodes.

- **`getNode(ref | array)`**  
  Retrieves a node (or an array of nodes) by reference.

- **`getNodes()`**  
  Returns an array of all nodes in the graph.

- **`getEdges()`**  
  Returns an array of all edges in the graph. Each edge is represented as an object with two properties: `src` and `tgt`, corresponding to the source and target nodes.

- **`findNode(predicate)`**  
  Scans all nodes and returns the first node that satisfies the provided predicate function. If no node matches, it returns `null`.

- **`getImmediatePredecessors(ref)`**  
  Returns the direct dependency nodes (i.e. immediate sources) of the given node.

- **`getPredecessors(ref, { transitive: true })`**  
  Returns all (transitive) predecessor nodes, meaning all nodes that can reach the given node.

- **`getImmediateSuccessors(ref)`**  
  Returns the nodes that directly depend on the given node.

- **`getSuccessors(ref, { transitive: true })`**  
  Returns all (transitive) dependent nodes reachable from the given node.

- **`getSources()`**  
  Retrieves all nodes with no incoming edges.

- **`getSinks()`**  
  Retrieves all nodes with no outgoing edges.

- **`toString()`**  
  Returns a human-readable string representation of the graph, where each line represents an edge in the format "source -> target".

- **`findPath(srcRef, tgtRef)`**  
  Finds a dependency path (an array of node keys) from the source to the target node. Returns `null` if no path exists.

- **`getInDegree(ref)`** / **`getOutDegree(ref)`**  
  Returns the number of incoming or outgoing edges for a given node.

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

## Recent Commit

**Commit:** *Reverted DSL/JSON graph creation support*

In this commit, support for creating graphs via DSL/JSON was removed. This decision was made because embedding values and computed functions in a DSL/JSON format posed significant challenges—each node needs to have either a value or a computed function, and handling uninitialized nodes or stringified functions (which may introduce security risks) made the approach impractical.

Graph creation now must be performed programmatically using the code-based API (e.g., using `createGraph()`, `createNode()`, etc.), which ensures clarity, type-safety, and security.

```
