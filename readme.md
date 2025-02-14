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
    - [Update Behavior for Stateful Nodes](#update-behavior-for-stateful-nodes)
    - [Function and Async Function Dependencies](#function-and-async-function-dependencies)
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
  Updates the node’s value. For computed nodes, this triggers recomputation.  
  For stateful nodes, `update()` now **forces a re-emission** of the current value by default—even if that value is deep-equal to the previous one. This makes it ideal for triggering refreshes of function dependencies that are meant to reflect side effects or asynchronous results.

  For example:

  ```js
  // Re-emits the current value (even if unchanged)
  count.update(); 
  
  // Updates based on a function:
  count.update(val => val + 1);
  
  // Works similar to set():
  count.update(42);
  ```

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

- **`addDependency(...args)`** and **`removeDependency(...args)`**  
  Manage dependencies for computed nodes using a unified API.

  - In **positional (array) mode** (when the computed node’s dependency was provided as an array), you may:
    - **Add dependencies:**
      ```js
      // Single dependency:
      computedNode.addDependency(dep1);
      // Multiple dependencies:
      computedNode.addDependency(dep1, dep2);
      // Or by providing an array:
      computedNode.addDependency([dep1, dep2]);
      ```
    - **Remove dependencies:**
      ```js
      // Remove a single dependency:
      computedNode.removeDependency(dep1);
      // Remove multiple dependencies:
      computedNode.removeDependency(dep1, dep2);
      // Or by providing an array:
      computedNode.removeDependency([dep1, dep2]);
      ```
  - In **named (object) mode** (when the computed node’s dependency was provided as an object), you may:
    - **Add dependencies:**
      ```js
      // Add by explicit key:
      computedNode.addDependency("x", dep1);
      // Or by merging an object:
      computedNode.addDependency({ x: dep1, y: dep2 });
      // Or simply pass a single dependency to have its id used as the key:
      computedNode.addDependency(dep1); // becomes { [dep1.id]: dep1 }
      ```
    - **Remove dependencies:**
      ```js
      // Remove by key (string or multiple strings):
      computedNode.removeDependency("x");
      computedNode.removeDependency("x", "y");
      // Remove by passing an object (keys are removed):
      computedNode.removeDependency({ x: true });
      // Remove by passing the node reference (using reference equality):
      computedNode.removeDependency(dep1);
      ```

> **Svelte Compatibility:**  
> Dagify nodes follow a similar API to Svelte stores, so they can be used directly in Svelte applications for reactive state management.

#### Update Behavior for Stateful Nodes

Stateful nodes (created with non-function values) use `update()` as a distinct API method that **forces a re-emission** by default. This means that even if the new value is deep‑equal to the old value, subscribers are notified. This behavior contrasts with `set()`/`next()`, which only emit when the new value is different.

#### Function and Async Function Dependencies

When you pass a function (or async function) as a dependency to `createNode()`, it is automatically wrapped as a computed node with no dependencies:

```js
// In normalizeDependency:
} else if (typeof dep === 'function') {
    // Instead of wrapping with from/defer,
    // wrap the function into a computed node with no dependencies.
    return createNode(dep, []);
}
```

This wrapping ensures that:
- **Synchronous functions** are re-evaluated every time the parent node updates.
- **Async functions** (e.g. `async () => 3`) are treated as computed nodes that resolve asynchronously; their value is incorporated once the promise resolves.
- This design provides more intuitive, implicit reactivity for function dependencies.
- To force a refresh of a dependency that has side effects, simply call `update()` on the parent node. The wrapped function dependency will re-run and the latest value will be pulled into the computation.

### ReactiveGraph API

Create a graph using `createGraph()`. The ReactiveGraph organizes nodes, prevents cycles, and provides extensive introspection.

**Creating Nodes:**

Nodes are created with the `createNode()` function. For example:

```js
const node1 = createNode(5); // A stateful node with an initial value of 5.
const node2 = createNode(
  (values) => values[0] + 4,
  [node1]
); // A computed node that depends on node1 (node2.value becomes 9).
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
  Retrieves an existing node or adds a new one if it does not exist. This method supports both a full Dagify node object (with an auto-generated id) and a tuple format (custom id plus node).

  **Example:**
  ```js
  // Using the node’s generated id:
  const nodeA = createNode(1);
  const a = graph.upsertNode(nodeA);

  // Using a custom id:
  const nodeB = createNode(2);
  const b = graph.upsertNode("two", nodeB);
  ```

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
  Adds an edge from the source node to the target node (with automatic cycle prevention). When connecting computed nodes, Dagify automatically adds the source node as a dependency of the target node. Depending on whether the target’s dependency structure is an array (positional) or an object (named), Dagify uses `addDependency()` or `updateDependencies()` respectively.

- **`disconnect(srcRef, tgtRef)`**  
  Removes the edge from the source to the target node.

- **`topologicalSort()`**  
  Returns an array of node keys sorted in topological order.

- **`update()`**  
  Recomputes all computed nodes in topological order.

- **`updateAsync()`**  
  Asynchronously updates all computed nodes.

- **`getNode(ref | array)`**  
  Retrieves a node (or an array of nodes) by reference.

- **`getNodes()`**  
  Returns an array of all nodes in the graph.

- **`getEdges()`**  
  Returns an array of all edges in the graph.

- **`findNode(predicate)`**  
  Scans all nodes and returns the first node that satisfies the provided predicate function.

- **`getImmediatePredecessors(ref)`**  
  Returns the direct dependency nodes of the given node.

- **`getPredecessors(ref, { transitive: true })`**  
  Returns all (transitive) predecessor nodes.

- **`getImmediateSuccessors(ref)`**  
  Returns the nodes that directly depend on the given node.

- **`getSuccessors(ref, { transitive: true })`**  
  Returns all (transitive) dependent nodes.

- **`getSources()`** and **`getSinks()`**  
  Retrieve nodes with no incoming or outgoing edges, respectively.

- **`toString()`**  
  Returns a human-readable string representation of the graph.

- **`findPath(srcRef, tgtRef)`**  
  Finds a dependency path from the source to the target node.

- **`getInDegree(ref)`** / **`getOutDegree(ref)`**  
  Return the number of incoming or outgoing edges for a given node.

- **`hasNode(ref)`** and **`hasEdge(srcRef, tgtRef)`**  
  Check for the existence of nodes and edges.

- **`clear()`**  
  Removes all nodes and edges from the graph.

- **`getConnectedComponent(ref)`**  
  Retrieves all nodes in the same connected component as the given node.

---

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
  Customize the format of node identifiers.

- **`fromObservable(observable)`**  
  Converts an RxJS Observable into a reactive node.

- **`batch(fn)`**  
  Executes multiple updates in batch mode so that subscribers receive only the final value.

- **`takeUntilCompleted()`**  
  A custom RxJS operator that completes a stream when a notifier (e.g., a node) completes.

## Usage Examples

### Creating Stateful and Computed Nodes

#### Stateful Node

```js
import { createNode } from "dagify";

const count = createNode(1);
count.subscribe(val => console.log("Count:", val));
count.set(5); // Updates count to 5.
```

#### Computed Node (Positional Dependencies)

```js
import { createNode } from "dagify";

const count = createNode(1);

// Using an array dependency. The computed function here is declared with a rest parameter,
// so the dependency array is spread into individual arguments.
const double = createNode(
  (...values) => values[0] * 2,
  [count]
);

double.subscribe(val => console.log("Double:", val));
count.set(3); // Automatically logs "Double: 6"
```

Alternatively, if you prefer the computed function to receive the dependency array as-is, declare it with one parameter:

```js
const doubleArray = createNode(
  (values) => values[0] * 2,
  [count]
);
```

#### Computed Node (Named Dependencies)

```js
import { createNode } from "dagify";

const a = createNode(10);
const b = createNode(20);

const sum = createNode(
  ({ a, b }) => a + b,
  { a, b }
);

sum.subscribe(val => console.log("Sum:", val)); // Logs: Sum: 30
```

#### Asynchronous Computed Node

```js
import { createNode } from "dagify";

const count = createNode(1);
const asyncDouble = createNode(
  ([val]) =>
    new Promise(resolve => setTimeout(() => resolve(val * 2), 50)),
  [count]
);

asyncDouble.subscribe(val => console.log("Async double:", val));
count.set(4); // Eventually logs "Async double: 8"
```

#### Function/Async Function Dependencies with Side Effects

When you pass a function (or async function) as a dependency, it is automatically wrapped as a computed node with no dependencies. This ensures that on every parent update, the function is re-evaluated. For example:

```js
// A synchronous function dependency:
const getter = () => someValue;
const x = createNode(([y]) => y + 2, [getter]);

// An asynchronous function dependency:
const asyncGetter = async () => {
  // some asynchronous work...
  return someValue;
};
const y = createNode(([v]) => v * 2, [asyncGetter]);
```

If your function has side effects, calling `update()` on the parent node will force re-computation of these dependencies, ensuring that the latest value (or side effect) is pulled in.

### Managing a Reactive Graph

```js
import { createGraph, createNode } from "dagify";

const graph = createGraph();

const a = createNode(1);
const b = createNode(2);
const sum = createNode(
  (values) => values[0] + values[1],
  [a]
);

graph.addNode(a);
graph.addNode(b);
graph.addNode(sum);

graph.connect(a, sum);
graph.connect(b, sum);

sum.subscribe(val => console.log("Sum:", val));

a.set(3); // Logs "Sum:" with the updated computed value.
b.set(4); // Logs "Sum:" with the updated computed value.
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
node.set(20); // Logs: "Skip subscription: 20"
```

#### Once Subscriptions

```js
import { createNode } from "dagify";

const node = createNode(0);
node.subscribeOnce(val => console.log("subscribeOnce:", val));
node.once.subscribe(val => console.log("once subscription:", val));
node.set(1); // Each logs only once.
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

**Commit:** *Refactor update behavior and function/async function dependency handling*

- The `update()` method for stateful nodes now forces a re-emission by default (bypassing deep equality).
- Function (and async function) dependencies are automatically wrapped as computed nodes with no dependencies, ensuring they re-evaluate on each parent update.
- Adjusted dependency removal logic to correctly identify and remove function dependencies by comparing the underlying function.
- Added documentation and examples to clarify the behavior for function/async function dependencies.
