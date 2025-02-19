# Dagify

Dagify is a lightweight functional-reactive programming (FRP) library for building reactive dependency graphs. It lets you create reactive nodes—both stateful and computed—that automatically propagate updates through a directed acyclic graph (DAG) of dependencies. Dagify is designed for modern JavaScript applications and works seamlessly with RxJS. In front-end projects, its nodes can also double as Svelte stores.

> **Note:**
> - Use `createNode()` to create a **ReactiveNode**.
> - Use `createGraph()` to create a **ReactiveGraph** for structured node management.
> - Use `createComposite()` to combine multiple nodes into a single reactive composite.
> - Use `createShallowNode()` to create a **ShallowReactiveNode** that only emits on shallow changes.

> **Important Breaking Change:**
> - **Node keys must now be Buffers.** A node’s id is defined as the z32‑encoded string of its key. This change removes the previous tuple‑mode for custom id assignment and deviates from the previous API.

## Table of Contents

- [Installation](#installation)
- [API Reference](#api-reference)
  - [ReactiveNode API](#reactivenode-api)
    - [Buffer Keys and z32‑Encoded IDs](#buffer-keys-and-z32-encoded-ids)
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

Create nodes using `createNode()`. A **ReactiveNode** supports both stateful (manual updates) and computed (derived) behavior.

#### Buffer Keys and z32‑Encoded IDs

- **Key Requirement:**  
  Every node must have a `key` property that is a Buffer.
- **Node ID:**  
  A node’s `id` is defined as the z32‑encoded string representation of its Buffer key (i.e. `node.id === z32.encode(node.key)`). This guarantees a fixed, consistent id format across the network.

#### Key Methods

- **`set(value)`**  
  Sets a new value for stateful nodes.  
  _Note: `set()` returns a promise that resolves on the next tick, allowing you to optionally await state propagation._

- **`update(fn)`**  
  Updates the node’s value.  
  For computed nodes, this triggers recomputation; for stateful nodes, it forces a re-emission (even if the value is deep‑equal to the previous one).

  ```js
  // Re-emit the current value:
  count.update();
  // Update based on a function:
  count.update(val => val + 1);
  // Directly set a new value:
  count.update(42);
  ```

- **`subscribe(callback)`**  
  Subscribes to value changes.

- **`subscribeOnce(callback)`**  
  Subscribes to the next emission only.

- **`skip`**  
  A subscription interface that skips the initial emission.

- **`once`**  
  A one-time subscription interface.

- **`toObservable()`**  
  Converts the node to an RxJS Observable.

- **`complete()`**  
  Completes the node so that no further updates occur.

- **`addDependency(...args)`** and **`removeDependency(...args)`**  
  Manage dependencies for computed nodes using a unified API.

  **Important:**
  - **Dependencies for computed nodes must be passed as a single argument:**  
    Either an array (positional mode) or an object (named mode).
  - The older API that accepted multiple dependency arguments is no longer supported.

#### Update Behavior for Stateful Nodes

Stateful nodes (created with non-function values) use `update()` to force re-emission of the current value, even if it is deep‑equal to the previous value. This behavior helps refresh function dependencies that might resolve asynchronously.

#### Function and Async Function Dependencies

When you pass a function (or async function) as the dependency to `createNode()`, it is automatically wrapped as a computed node:
- **Synchronous functions** are re-evaluated on every update.
- **Async functions** are treated as computed nodes that update once the promise resolves.

#### Shallow Reactive Nodes

Use `createShallowNode()` to create a node that only emits when shallow differences occur (i.e. when the top‑level reference changes).

```js
import { createShallowNode } from "dagify";

const shallowNode = createShallowNode({ a: { b: 1 } });
shallowNode.subscribe(val => console.log("Shallow node:", val));
shallowNode.set({ a: { b: 1 } }); // Update is emitted if top‑level reference changes.
```

### ReactiveGraph API

Create a graph using `createGraph()`. The **ReactiveGraph** organizes nodes, prevents cycles, and provides extensive introspection—all while relying internally on Buffer-based keys.

**Key Features:**

- **Buffer-Based Keys:**  
  Every node’s key is a Buffer. A node’s id is its z32‑encoded string (e.g. used in error messages or `toString()`).

- **Node Management:**
  - **`addNode(node)`**  
    Adds a node (a dagify node object with a Buffer key).
  - **`addNodes(nodes)`**  
    Adds multiple nodes.
  - **`upsertNode(node)`**  
    Retrieves an existing node by its key or adds it if not present.

- **Edge Management:**
  - **`connect(srcRef, tgtRef)`**  
    Connects nodes. All node references are resolved to Buffer keys internally.
  - **`disconnect(srcRef, tgtRef)`**  
    Disconnects nodes.
  - Cycle detection is enforced—attempting to create a cycle throws an error.

- **Graph Introspection:**  
  Methods such as `getNode()`, `getNodes()`, `getEdges()`, `findNode()`, `getInDegree()`, `getOutDegree()`, `hasNode()`, and `hasEdge()` allow detailed inspection of the graph structure.

- **Update Propagation:**
  - **`update()`**  
    Calls `update()` on all computed nodes in topological order.
  - **`updateAsync()`**  
    Asynchronously updates computed nodes in order.

- **Graph Analysis:**
  - **`topologicalSort()`**  
    Returns an array of node keys (Buffers) sorted in topological order.
  - **`getConnectedComponent(ref)`**  
    Returns the connected component (all nodes reachable in any direction) for a given node.

- **String Representation:**
  - **`toString()`**  
    Returns a human‑readable string representation of the graph (using z32‑encoded ids).

### Execution Node API

**ExecutionNodes** extend the ReactiveNode abstraction to allow explicit control over when values are emitted. Instead of automatically propagating updates when dependencies change or when subscribers are added, an ExecutionNode only emits its value when it is explicitly triggered. This behavior applies to both computed nodes (which derive their state from dependencies) and stateful nodes (which hold a direct value).

#### Creating an ExecutionNode

You can create an ExecutionNode using the `createExecutionNode()` factory function. For computed nodes, you supply a function and (optionally) dependencies; for stateful nodes, you supply a value. In either case, the node will only emit its state when `triggerExecution()` is called (or when an external execution trigger is provided).

```js
/**
 * Creates a new ExecutionNode instance.
 *
 * This factory function instantiates an ExecutionNode that only emits values when explicitly triggered.
 * For computed nodes, the node's value is derived from the provided function and dependencies,
 * and will only recompute and emit upon a manual trigger.
 * For stateful nodes, the provided value is used and will only be emitted when triggered.
 *
 * @param {Function|*} fnOrValue - For computed nodes, a function that derives the node's value from its dependencies;
 *                                 for stateful nodes, the initial value.
 * @param {Array|Object} [dependencies=[]] - Optional dependencies for computed nodes. Can be an array for positional
 *                                           dependencies or an object for named dependencies. Ignored for stateful nodes.
 * @param {Subject} [executionStream] - Optional RxJS Subject that controls triggering of the node. If not provided,
 *                                      a new Subject is created internally.
 * @returns {ExecutionNode} A new ExecutionNode instance.
 */
const createExecutionNode = (fnOrValue, dependencies = [], executionStream) =>
  new ExecutionNode(fnOrValue, dependencies, executionStream);
```

#### Example Usage

**Stateful ExecutionNode:**

```js
import { createExecutionNode } from "dagify";

const statefulNode = createExecutionNode(42);
statefulNode.subscribe(val => console.log("Stateful value:", val));

// No emission occurs on subscription. When triggered, the node emits its current value.
statefulNode.triggerExecution(); // Logs: "Stateful value: 42"
```

**Computed ExecutionNode:**

```js
import { createNode, createExecutionNode } from "dagify";

// Create base stateful nodes.
const a = createNode(10);
const b = createNode(20);

// Create a computed node that sums its dependencies.
const sumNode = createExecutionNode(
  ({ a, b }) => a + b,
  { a, b }
);

// No emission occurs on subscription.
sumNode.subscribe(val => console.log("Computed sum:", val));

// The computed node's internal value is computed upon creation (sum equals 30), but it won't emit until triggered.
console.log("Internal computed value:", sumNode.value); // 30

// Triggering forces recomputation and emission.
sumNode.triggerExecution(); // Logs: "Computed sum: 30"
```

#### Key Points

- **Explicit Triggering:**  
  ExecutionNodes do not automatically emit their value when dependencies change or when a subscriber is added. They emit only when `triggerExecution()` is called (or via an external execution stream).

- **Push-Based Updates:**  
  This model allows you to control propagation of state explicitly, which can be useful when you want to optimize update timing, rate limit emissions, or coordinate multiple reactive flows.

- **Uniform API:**  
  The same API works for both computed and stateful nodes, letting you use execution nodes as a fundamental building block in your reactive graphs.

---

### Composite Nodes

Composite nodes are created using `createComposite()` and allow you to combine multiple nodes into a single reactive unit. The composite updates when any of its constituent nodes change.

#### `set()` Method Behavior for Composite Nodes

Composite nodes support a versatile `set()` method that updates the underlying child nodes, with behavior that varies based on the provided value type:

- **Array Mode:**
  - **Array Input:**  
    When an array is passed to `set()`, the composite updates its child nodes by matching array indexes:
    - **Partial Update:**  
      If the provided array is **shorter** than the number of child nodes, only the nodes corresponding to the provided indexes are updated; the remaining nodes remain unchanged.
    - **Extra Values:**  
      If the provided array is **longer** than the number of child nodes, the extra values are simply ignored.
  - **Single Value Input:**  
    If a non-array value is passed to `set()`, every child node is updated with that same value.

- **Object Mode:**
  - **Object Input:**  
    When an object is provided, `set()` looks for keys that match the composite’s dependencies:
    - **Matching Keys:**  
      For keys that correspond to a child node, the node is updated with the new value.
    - **Non-Matching Keys:**  
      Any keys that do not match a child node are ignored. This allows partial updates by only providing the keys you wish to change without affecting the other nodes.

This flexible design is particularly useful in network-replicated scenarios where the incoming update might represent only a subset of the composite's full structure. Partial updates can be applied without errors, and extra or non-matching values are simply disregarded.

### Node Factory API

The `nodeFactory` function provides a lazy mechanism to create and manage nodes on-demand. It returns a proxy that:

- **Lazily Creates Nodes:**  
  When a property is accessed, it creates a node using `createNode(value, deps)` and caches it.
  - For computed nodes (when `value` is a function), dependencies are applied.
  - For stateful nodes (when `value` is not a function), an optional activator function is invoked.
- **Supports Iteration:**  
  The proxy implements the iterator protocol, yielding sequentially created nodes (up to a maximum count).
- **Clear Method:**  
  The factory exposes a `clear()` method to remove all cached nodes (calling `complete()` on each if available).

### Helper Functions

- **`fromObservable(observable)`**  
  Converts an RxJS Observable into a reactive node.
- **`batch(fn)`**  
  Batches multiple updates so that subscribers receive only the final value.
- **`takeUntilCompleted()`**  
  A custom RxJS operator that completes a stream when a notifier (e.g. a node) completes.

## Usage Examples

### Creating Stateful and Computed Nodes

#### Stateful Node

```js
import { createNode } from "dagify";

const count = createNode(1);
count.subscribe(val => console.log("Count:", val));
count.set(5).then(() => console.log("State updated."));
```

#### Computed Node (with Dependencies)

Dependencies must be provided as a single argument: either an array (positional) or an object (named).

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

### Creating a Shallow Reactive Node

```js
import { createShallowNode } from "dagify";

const shallowNode = createShallowNode({ a: { b: 1 } });
shallowNode.subscribe(val => console.log("Shallow node:", val));
shallowNode.set({ a: { b: 1 } }); // Emits update if top-level reference changes
```

### Managing a Reactive Graph

```js
import { createGraph, createNode } from "dagify";

const graph = createGraph();

const a = createNode(1);
const b = createNode(2);
const sum = createNode((values) => values[0] + values[1], [a]);

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

#### Skip Initial Emission and Once Subscriptions

```js
import { createNode } from "dagify";

const node = createNode(10);
node.skip.subscribe(val => console.log("Skip subscription:", val));
node.subscribeOnce(val => console.log("subscribeOnce:", val));
node.once.subscribe(val => console.log("once subscription:", val));
node.set(20); // Each logs only once.
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