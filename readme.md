# Dagify

Dagify is a lightweight functional-reactive programming (FRP) library for building reactive dependency graphs. It lets you create reactive nodes—both stateful and computed—that automatically propagate updates through a directed acyclic graph (DAG) of dependencies. Dagify is designed for modern JavaScript applications and works seamlessly with RxJS. In front-end projects, its nodes can also double as Svelte stores.

> **Note:**
> - Use `createNode()` to create a **ReactiveNode**.
> - Use `createGraph()` to create a **ReactiveGraph** for structured node management.
> - Use `createComposite()` to combine multiple nodes into a single reactive composite.
> - Additional helper functions like `batch()`, `fromObservable()`, `setIdGenerator()`, and `takeUntilCompleted()` enhance your workflow.
> - Use `createShallowNode()` to create a **ShallowReactiveNode** that only emits on shallow changes.

## Table of Contents

- [Installation](#installation)
- [API Reference](#api-reference)
  - [ReactiveNode API](#reactivenode-api)
    - [Update Behavior for Stateful Nodes](#update-behavior-for-stateful-nodes)
    - [Function and Async Function Dependencies](#function-and-async-function-dependencies)
    - [Shallow Reactive Nodes](#shallow-reactive-nodes)
  - [ReactiveGraph API](#reactivegraph-api)
  - [Composite Nodes](#composite-nodes)
  - [Node Factory API](#node-factory-api)
  - [Helper Functions](#helper-functions)
- [Usage Examples](#usage-examples)
  - [Creating Stateful and Computed Nodes](#creating-stateful-and-computed-nodes)
  - [Creating a Shallow Reactive Node](#creating-a-shallow-reactive-node)
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
  **Important:** `set()` now returns a promise (using `setTimeout(resolve, 0)`) that resolves on the next tick. This is intended as a convenience so that you may optionally await state propagation, especially in tests.

- **`update(fn)`**  
  Updates the node’s value. For computed nodes, this triggers recomputation.  
  For stateful nodes, `update()` forces a re-emission of the current value by default—even if that value is deep‑equal to the previous one. This is useful for triggering refreshes of function dependencies that have side effects or resolve asynchronously.

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

  **Important:**

  - **Computed nodes now only support a single dependency argument.**  
    You must pass dependencies as either a single array (for positional mode) or an object (for named mode).  
    For example, the following are **not supported**:
    ```js
    // Not supported:
    createNode((arg1, arg2) => {}, arg1, arg2);
    createNode((arg1, arg2) => {}, [arg1, arg2]);
    ```

  - **Positional (array) mode:**
    - **Add dependencies:**
      ```js
      // Single dependency:
      computedNode.addDependency(dep1);
      // Multiple dependencies via an array:
      computedNode.addDependency([dep1, dep2]);
      ```
    - **Remove dependencies:**
      ```js
      // Remove a single dependency:
      computedNode.removeDependency(dep1);
      // Remove multiple dependencies by passing an array:
      computedNode.removeDependency([dep1, dep2]);
      ```

  - **Named (object) mode:**
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

Stateful nodes (created with non-function values) use `update()` as a distinct API method that forces a re-emission by default. This means that even if the new value is deep‑equal to the old value, subscribers are notified. This behavior contrasts with `set()`/`next()`, which only emit when the new value is different.

#### Function and Async Function Dependencies

When you pass a function (or async function) as a dependency to `createNode()`, it is automatically wrapped as a computed node with no dependencies. This ensures that:
- **Synchronous functions** are re-evaluated every time the parent node updates.
- **Async functions** (e.g. `async () => 3`) are treated as computed nodes that resolve asynchronously; their value is incorporated once the promise resolves.
- To force a refresh of a dependency with side effects, simply call `update()` on the parent node. The wrapped function dependency will re-run and pull in the latest value.

#### Shallow Reactive Nodes

In addition to the standard deep-equality checking, Dagify now offers shallow reactive nodes. Use `createShallowNode()` to create nodes that emit updates only when shallow differences are detected.

```js
import { createShallowNode } from "dagify";

const shallowNode = createShallowNode({ a: { b: 1 } });
shallowNode.subscribe(val => console.log("Shallow node:", val));

// Even if a new object with deep-equal values is set,
// if the top-level reference changes, an update is emitted:
shallowNode.set({ a: { b: 1 } });
```

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

Nodes are added to the graph using either single or batch methods:

- **`addNode(node)` or `addNode(id, node)`**  
  Adds a single node to the graph.
  - With one argument, the node’s generated identifier is used.
  - With two arguments, the first is a custom identifier.

- **`addNodes(nodes)`**  
  Adds multiple nodes to the graph. Each element can be:
  1. A node object (using its generated id), or
  2. A tuple `[customId, node]`.

- **`upsertNode(node)` or `upsertNode(id, node)`**  
  Retrieves an existing node or adds a new one if it does not exist.

### Node Factory API

The `nodeFactory` function provides a convenient, lazy mechanism to create and manage nodes on-demand. It returns a proxy that:

- **Lazily creates nodes:**  
  When a property is accessed on the factory, it calls `createNode(value, deps)` to create a new node and caches it.
  - For computed nodes (when `value` is a function), the supplied dependencies (`deps`) are applied.
  - For stateful nodes (when `value` is not a function), dependencies are ignored. Instead, the second argument is interpreted as an optional activator function that is invoked when a node is created.
- **Supports iteration:**  
  The proxy implements the iterator protocol, yielding sequentially created nodes (up to a maximum specified by the `max` parameter).
  > **Note:** In indexed mode, once the maximum number of nodes is reached (e.g., using an array destructuring like:
  > ```js
  > const [...nodes] = nodeFactory("hello", 1000);
  > ```
  > Dagify simply stops creating new nodes rather than throwing an error.
- **Provides a clear method:**  
  The factory exposes a `clear()` method that deletes all cached nodes. For each deleted node, if it has a `complete()` method, that method is invoked before removal.

**Parameter Details:**

- For computed nodes:
  - The first argument is a function.
  - The second argument is treated as an array (or single dependency) to be passed to node creation.
- For stateful nodes:
  - The first argument is any non-function value.
  - The second argument is treated as an optional activator function.  
    If the activator is not supplied, a default identity function is used.
- If the second argument is a number, it is interpreted as the maximum number of nodes (`max`). If `max` is not supplied, it defaults to 1000.

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

// For stateful (static) nodes:
const staticFactory = nodeFactory(42, (id, node) => {
  console.log(`Node activated: ${id}`, node);
}, 100);
const staticNode = staticFactory.someKey;
console.log("Static node value:", staticNode.value);

// Iterating over nodes:
for (const node of computedFactory) {
  console.log("Iterated node:", node);
  break; // Avoid infinite iteration
}

// Clearing all nodes:
computedFactory.clear();
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
count.set(5) // Updates count to 5. Note that set() returns a promise.
  .then(() => console.log("State updated."));
```

#### Computed Node (Positional or Named Dependencies)

For computed nodes, dependencies must be provided as a single array (for positional mode) or an object (for named mode). For example:

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

When you pass a function (or async function) as a dependency, it is automatically wrapped as a computed node with no dependencies. This ensures that on every parent update, the function is re-evaluated.

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

### Creating a Shallow Reactive Node

Use `createShallowNode()` to create a node that only emits when shallow differences are detected:

```js
import { createShallowNode } from "dagify";

const shallowNode = createShallowNode({ a: { b: 1 } });
shallowNode.subscribe(val => console.log("Shallow node:", val));

// Even if a new object with deep-equal values is set,
// if the top-level reference changes, an update is emitted:
shallowNode.set({ a: { b: 1 } });
```

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

a.set(3); // Logs updated computed value.
b.set(4); // Logs updated computed value.
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

*feat(nodeFactory, ReactiveNode#set): add optional activator to nodeFactory and update set() to return a promise*

- Updated `nodeFactory` to support an optional activator function for stateful nodes and infer max when a number is provided.
- Documented the new lazy node creation mechanism and activator behavior.
- Modified `ReactiveNode#set` to return a promise (using `setTimeout(resolve, 0)`) for optional awaiting of state propagation.
```
