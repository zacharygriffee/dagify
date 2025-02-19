# Dagify: A Reactive Dependency Graph Library

Dagify is a JavaScript library designed for building and managing reactive dependency graphs. It enables developers to create dynamic, interconnected data flows with support for computed nodes, shallow reactive nodes, manual execution, and network synchronization. With its composable API, Dagify makes it easy to construct complex reactive systems, perform batched updates, and maintain consistent state across distributed applications.

# Public API Documentation

The following functions are exposed through the public index files. They serve as the primary entry points for users to create and manage reactive nodes, graphs, composites, and perform related operations.


---

## Node Creation & Management

### createNode

Creates a new reactive node. This function instantiates a standard reactive node that can be either computed (when passed a function) or static.

**Signature**

```js
createNode(fnOrValue, dependencies = [], config)
```

**Parameters**

- **fnOrValue**: A function (for computed nodes) or an initial value (for static nodes).
- **dependencies**: An array (or any list) of dependencies for computed nodes.
- **config**: Optional configuration options.

**Returns**

A new instance of a reactive node.

---

### createShallowNode

Creates a new shallow reactive node that only emits updates when shallow changes to its value are detected. It uses shallow equality (instead of deep equality) for change detection.

**Signature**

```js
createShallowNode(fnOrValue, dependencies = [], config)
```

**Parameters**

- **fnOrValue**: A function to compute the node’s value (for computed nodes) or a static value.
- **dependencies**: An array or single dependency.
- **config**: Optional configuration options.

**Returns**

A new instance of `ShallowReactiveNode`.

---

### createBridgeNode

Creates a bridge node that connects an input node to an output node. The bridge node forwards new values from the input node to the output node. Its internal value always reflects the output node’s current state. Errors during output computation are handled silently.

**Signature**

```js
createBridgeNode(input, output, config = {})
```

**Parameters**

- **input**: The reactive node to which updates are sent.
- **output**: The reactive node whose processed (computed) value is exposed.
- **config**: Optional configuration options.

**Returns**

A new instance of `BridgeNode`.

---

### createExecutionNode

Creates a new execution node that only emits values when explicitly triggered. In computed mode, the node recomputes its value only when manually triggered (or via an external execution stream), while static nodes simply emit their current value when triggered.

**Signature**

```js
createExecutionNode(fnOrValue, dependencies = [], executionStream, config)
```

**Parameters**

- **fnOrValue**: A function (for computed nodes) or an initial value (for static nodes).
- **dependencies**: Dependencies for computed nodes (positional array or named object). Ignored for static nodes.
- **executionStream**: An optional RxJS Subject to control triggering. If not provided, one is created internally.
- **config**: Optional configuration options.

**Returns**

A new instance of `ExecutionNode`.

---

### batch

Executes multiple updates in batch mode so that subscribers receive only the final update. This is useful for performance optimization when several changes occur together.

**Signature**

```js
batch(fn)
```

**Parameters**

- **fn**: A function containing multiple updates that will be batched.

---

### nodeFactory

Exports a lazy node creation utility. The node factory returns a Proxy object that lazily creates and manages nodes.

**Usage**

```js
nodeFactory(value, depsOrActivator, max)
```

**Parameters**

- **value**: The base value or function for node creation.
- **depsOrActivator**: For computed nodes, an array (or single dependency) of dependencies; for stateful nodes, an activator function (or number representing max nodes).
- **max**: Maximum number of nodes to create (default is 1000).

**Returns**

A Proxy object for lazy node management.

---

### isDagifyNode

Exports a utility to check if a node is a Dagify node.  
*(See the implementation for further details.)*

---

## Graph & Composite

### createGraph

Creates a new reactive graph instance. The graph manages nodes and the dependencies (edges) between them. It also provides utilities for connecting, disconnecting, and updating nodes in a topological order.

**Signature**

```js
createGraph(config)
```

**Parameters**

- **config**: Optional configuration object for the graph.

**Returns**

A new instance of `ReactiveGraph`.

---

### createComposite

Creates a composite node from a collection of reactive nodes. The composite’s value is a combination (array or object) of the values of its child nodes.

**Signature**

```js
createComposite(nodes)
```

**Parameters**

- **nodes**: Either an array or an object (mapping keys to reactive nodes).

**Returns**

A new composite instance.

---

## Synchronization & Utilities

### syncNode & getEncoder

The index file also re-exports all public methods from the sync node module and the encoder utility. The `syncNode` function creates a synchronization wrapper for a reactive node (to support network replication), while `getEncoder` resolves a value encoding function.

**Usage**

These are exported via:

```js
export * from "./syncNode.js";
export * from "../util/getEncoder.js";
```

Refer to the respective modules for detailed API documentation.

> citeturn1file2

# API Documentation

This documentation covers the main classes and functions from the following files:

- **Composite.js** citeturn0file0
- **ReactiveGraph.js** citeturn0file1
- **syncNode.js** citeturn0file2
- **BridgeNode.js** citeturn0file3
- **ExecutionNode.js** citeturn0file4
- **nodeFactory.js** citeturn0file5
- **ReactiveNode.js** citeturn0file6
- **ShallowReactiveNode.js** citeturn0file7

---

## Contents

- [Composite](#composite)
- [ReactiveGraph](#reactivegraph)
- [syncNode](#syncnode)
- [BridgeNode](#bridgenode)
- [ExecutionNode](#executionnode)
- [nodeFactory](#nodefactory)
- [ReactiveNode](#reactivenode)
- [ShallowReactiveNode](#shallowreactivenode)

---

## Composite

`Composite` is a collection of reactive nodes that emits a composite value whenever any of its children change. It can be constructed from an array or an object of nodes.

### Constructor

```js
new Composite(nodes, config)
```

- **nodes**: Either an `Array<ReactiveNode>` or an `Object<string, ReactiveNode>`.
- **config**: Optional configuration object. May include a `keyPair` property.

### Properties

- **id**: Returns a z32‑encoded unique identifier based on the node’s public key.
- **key**: Gets or sets the node’s public key (32-byte Buffer).
- **discoveryKey**: Returns the discovery key (computed with hypercore-crypto).

### Methods

- **addNodes(nodes)**  
  Adds new reactive nodes. For array-based composites, accepts a single node or array of nodes. For object-based composites, accepts an object mapping keys to nodes.

- **removeNodes(nodes)**  
  Removes nodes from the composite. For arrays, accepts a node or array of nodes; for objects, accepts key(s) or an object with keys to remove.

- **_emit(force?)**  
  Emits the current composite value if it has changed or if forced.

- **_initialize()**  
  Subscribes to all child nodes and initializes internal state.  
  *(Internal method – not part of the public API)*

---

## ReactiveGraph

`ReactiveGraph` represents a reactive dependency graph for dagify nodes. Each node is stored using a Buffer key and identified using a z32‑encoded id.

### Constructor

```js
new ReactiveGraph(config)
```

- **config**: Optional configuration object.

### Methods

- **_idForKey(key)**  
  Returns the z32‑encoded string representation of a given Buffer key.

- **_resolveKey(ref)**  
  Resolves a node reference (string, Buffer, or dagify node) into a Buffer key.

- **upsertNode(node)**  
  Retrieves an existing node by key or adds a new one if it does not exist.  
  *Throws an error if the node is invalid.*

- **addNode(node)**  
  Adds a new node to the graph.  
  *Throws if a node with the same key already exists.*

- **addNodes(nodes)**  
  Adds multiple nodes.

- **removeNode(nodeRef)**  
  Removes a node and all its connections (both outgoing and incoming edges).

- **connect(srcRef, tgtRef)**  
  Connects two nodes by adding an edge from the source to the target. Validates node existence and checks for cycles.

- **disconnect(srcRef, tgtRef)**  
  Disconnects source node(s) from target node(s).

- **createsCycle(srcKey, tgtKey)**  
  Checks if connecting two nodes would create a cycle.

- **update() / updateAsync()**  
  Updates computed nodes in topological order (synchronously or asynchronously).

- **topologicalSort()**  
  Returns an array of node keys sorted in topological order.  
  *Throws an error if a cycle is detected.*

- **getNode(refOrRefs)**, **getNodes()**, **getEdges()**  
  Retrieve nodes or edges from the graph.

- **findNode(predicate)**  
  Finds the first node matching a given predicate.

- **getImmediatePredecessors(ref)** / **getPredecessors(ref, options)**  
  Retrieves immediate or transitive predecessor nodes.

- **getImmediateSuccessors(ref)** / **getSuccessors(ref, options)**  
  Retrieves immediate or transitive successor nodes.

- **getSources()** / **getSinks()**  
  Returns nodes with no incoming or outgoing edges, respectively.

---

## syncNode

`syncNode` is a function that creates a synchronization wrapper for a reactive node to enable network replication.

### Function Signature

```js
const syncNode = (nodeOrKey, config) => { ... }
```

### Parameters

- **nodeOrKey**: Either an existing ReactiveNode or a key (string or Buffer) for a remote node.
- **config**: Optional configuration object with:
  - **valueEncoding**: (Optional) String value encoding (e.g., `"utf8"`).
  - **mode**: Local mode, one of `"sink"`, `"source"`, or `"transform"` (default is `"transform"`).

### Returns

An object containing:
- **node**: The synchronized reactive node.
- **sync(socket)**: A method that establishes an RPC-based synchronization over a given network socket.  
  This method handles the handshake process and sets up RPC responders/subscriptions to synchronize state.

---

## BridgeNode

`BridgeNode` is a thin wrapper that connects an input node (where values are fed) with an output node (whose computed value is exposed).

### Constructor

```js
new BridgeNode(inputNode, outputNode, config)
```

- **inputNode**: A ReactiveNode to which new values are forwarded.
- **outputNode**: A ReactiveNode whose value is used as the BridgeNode’s value.
- **config**: Optional configuration.

### Methods

- **set(newValue)**  
  Forwards a new value to the input node and then forces the output node to recompute. Returns a promise that resolves on the next tick.

- **complete()**  
  Completes the BridgeNode by unsubscribing from the output node and then calling the base complete method.

---

## ExecutionNode

`ExecutionNode` extends `ReactiveNode` to allow manual triggering of computation or state emission. Automatic dependency-triggered updates are suppressed.

### Constructor

```js
new ExecutionNode(fnOrValue, dependencies, executionStream, config)
```

- **fnOrValue**: For computed nodes, a function; for static nodes, a value.
- **dependencies**: For computed nodes, the dependency (or dependencies) on which the node relies.
- **executionStream**: An RxJS Observable (or stream) used to trigger manual execution.
- **config**: Optional configuration.

### Methods

- **compute(manualTrigger = false)**  
  Overrides the standard compute. In manual mode, the node recomputes only when triggered.

- **triggerExecution()**  
  Manually triggers execution:
  - For computed nodes, forces recomputation.
  - For static nodes, emits the current value.

- **_subscribeCore(observer)**  
  Custom subscription logic so that an initial value is not emitted automatically.  
  *(Internal – not meant for direct use.)*

- **dispose()**  
  Cleans up subscriptions related to the execution stream.

---

## nodeFactory

`nodeFactory` is a lazy node creation and management utility that returns a Proxy. It supports both computed and stateful nodes.

### Function Signature

```js
const nodeFactory = (value, depsOrActivator, max) => { ... }
```

### Parameters

- **value**: The base value or function to create nodes.
  - If a function, a computed node is created and the second argument is treated as dependencies.
  - Otherwise, a static node is created.
- **depsOrActivator**:
  - For computed nodes: an array (or a single dependency) used during node creation.
  - For static nodes: an activator function that is called on node creation.
  - Alternatively, if a number is provided, it is taken as `max`.
- **max**: The maximum number of nodes that can be created. Defaults to 1000.

### Returns

A Proxy object that:
- Lazily creates nodes on property access.
- Supports iteration to get sequentially created nodes.
- Provides a `clear()` method to remove all stored nodes.

---

## ReactiveNode

`ReactiveNode` is the core class representing a node in a directed acyclic graph (DAG) with support for computed values, subscriptions, error handling, and dependency management.

### Constructor

```js
new ReactiveNode(fnOrValue, dependencies, config)
```

- **fnOrValue**:
  - For computed nodes: a function that computes a value.
  - For static nodes: any non-function value.
- **dependencies**: For computed nodes, an array or object representing the node’s dependencies.
- **config**: Optional configuration options (e.g., custom keyPair, errorRetentionTime).

### Properties

- **dependencyError$**: An Observable that emits errors from dependencies.
- **isDagifyNode**: Returns `true` to indicate this is a dagify node.
- **isAsync**: Indicates if the node’s computation is asynchronous.
- **isComputed**: Boolean flag indicating if the node is computed.
- **id**: A unique identifier (z32‑encoded public key).
- **key**: Gets or sets the public key (32-byte Buffer).
- **discoveryKey**: Returns the discovery key.
- **skip**: Returns an Observable that skips the initial emission.
- **once**: Returns an Observable that emits only the next value.

### Methods

- **compute()**  
  Computes the node’s value based on dependencies. Handles synchronous, observable, or promise-based results.

- **set(newValue)**  
  For static nodes, manually sets a new value.  
  *Throws an error if called on a computed node.*

- **next(value)**  
  Acts like `set()` for static nodes or triggers recomputation for computed nodes.

- **subscribe(observer)**  
  Subscribes to value changes on the node.  
  Returns an unsubscribe function.

- **subscribeOnce(observer)**  
  Subscribes to the node and automatically unsubscribes after one emission.

- **error(err)**  
  Notifies subscribers of an error.

- **complete()**  
  Completes the node, notifying subscribers and cleaning up resources.

- **_setValue(newValue, forceEmit?)**  
  Internal method to update the node’s value and notify subscribers if the value changes.

- **_subscribeCore(observer)**, **_initializeObserver(observer)**, **_notifyAll(type, value)**  
  Internal methods for handling subscriptions and notifications.

- **_unsubscribeDependencies()**  
  Unsubscribes from all dependency subscriptions.

- **addDependency(...args)**  
  Adds one or more dependencies to a computed node. Supports both positional (array) and named (object) dependencies.

- **filterDependencyErrors(depValue, normalizedDeps, errorSubject)**  
  Filters dependency values to remove errors before computation.

- **Static Methods:**
  - **ReactiveNode.scheduleUpdate(node)**  
    Schedules an update for a node.
  - **ReactiveNode.batch(fn)**  
    Runs multiple updates in batch mode so that subscribers receive only the final update.

---

## ShallowReactiveNode

`ShallowReactiveNode` extends `ReactiveNode` but overrides value comparison to use shallow equality (instead of deep equality).

### Implementation

- Overrides the **_setValue(newValue, forceEmit?)** method to compare previous and new values using a shallow equality check.

# Examples
Below are two examples: one basic and one advanced, demonstrating how to use Dagify.

---

## Basic Example: Static and Computed Nodes

This example shows how to create a static node and a computed node that derives its value from the static node. When the static node is updated, the computed node automatically recalculates its value.

```js
import { createNode } from "dagify";

// Create a static node with an initial value.
const staticNode = createNode(10);

// Create a computed node that doubles the value of the static node.
const computedNode = createNode(
  (deps) => deps[0] * 2, // Function receives an array of dependencies.
  [staticNode]
);

// Subscribe to the computed node to log its value on every update.
computedNode.subscribe((value) => {
  console.log("Computed Node Value:", value);
});

// Update the static node's value after 1 second.
setTimeout(() => {
  staticNode.set(20);
  // Expected output after update: "Computed Node Value: 40"
}, 1000);
```

*Explanation:*  
A static node is created with a starting value of 10. The computed node receives the static node as a dependency and computes its value by doubling it. When you update the static node from 10 to 20, the computed node automatically recalculates and emits the new value (40).

---

## Advanced Example: Composite and Graph with Batch Updates

This advanced example demonstrates how to build a reactive graph that connects multiple nodes, combine them into a composite, and use batch updates for performance optimization. The composite aggregates multiple nodes, while the graph manages their dependencies and connections.

```js
import { createNode, createComposite, createGraph, batch } from "dagify";

// Create nodes:
const nodeA = createNode(5);
const nodeB = createNode(
  (deps) => deps[0] + 3,
  [nodeA]
);
const nodeC = createNode(
  (deps) => deps[0] * 2,
  [nodeB]
);

// Build a composite that aggregates nodeA, nodeB, and nodeC.
const composite = createComposite([nodeA, nodeB, nodeC]);

composite.subscribe((values) => {
  console.log("Composite Values:", values);
});

// Create a reactive graph and add nodes to it.
const graph = createGraph();
graph.addNode(nodeA);
graph.addNode(nodeB);
graph.addNode(nodeC);

// Connect nodes in the graph: nodeA -> nodeB and nodeB -> nodeC.
graph.connect(nodeA, nodeB);
graph.connect(nodeB, nodeC);

// Log the topological order of nodes in the graph.
const sortedKeys = graph.topologicalSort();
console.log("Graph Topological Order:", sortedKeys);

// Perform multiple updates in a batch to optimize emissions.
batch(() => {
  // Update static node nodeA.
  nodeA.set(10);
  // Further updates can be added here.
  nodeA.set(15);
});

// After batch completes, the composite will emit a final combined update.
// Expected output: Composite values reflecting the final state of nodeA, nodeB, and nodeC.
```

*Explanation:*
1. **Nodes & Dependencies:**
  - **nodeA:** A static node with an initial value.
  - **nodeB:** A computed node that adds 3 to nodeA’s value.
  - **nodeC:** A computed node that doubles nodeB’s value.

2. **Composite:**  
   The composite aggregates these nodes. Whenever any of the nodes change, the composite emits the updated array of values.

3. **Graph:**  
   A reactive graph is created to manage these nodes and their dependencies. Nodes are connected in a chain (nodeA → nodeB → nodeC) and the topological order is logged.

4. **Batch Updates:**  
   The `batch` function groups multiple updates to nodeA. During a batch, intermediate changes are suppressed so that subscribers only see the final state.
   
This advanced example illustrates how Dagify can be used to build complex reactive systems with integrated dependency management and optimized update handling.


---

## License

Dagify is released under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Please review our [contributing guidelines](CONTRIBUTING.md) and [code of conduct](CODE_OF_CONDUCT.md) before submitting pull requests.

## Acknowledgements

Special thanks to all contributors and the open source community for making this project possible.

---

© 2025 Dagify. All rights reserved.