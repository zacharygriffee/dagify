# Dagify: A Reactive Dependency Graph Library

Dagify is a JavaScript library designed for building and managing reactive dependency graphs. It enables developers to create dynamic, interconnected data flows with support for computed nodes, shallow reactive nodes, manual execution, and batched updates. With its composable API, Dagify makes it easy to construct complex reactive systems and maintain consistent state within your application.

> **Note:** Dagify’s networking and node synchronization features have been removed. These features will be handled in a separate library.

---

## Package Exports

Dagify now offers separate entry points for secure and unsecure implementations, with secure as the default. The exports are structured as follows:

- **Default & Secure:**
  - **Default Import (`"."`):**
    ```js
    import dagify from "dagify"; // Uses the secure implementation.
    ```
  - **Secure Shortcut:**
    ```js
    import dagify from "dagify/secure";
    ```
  - **Secure Node:**
    ```js
    import node from "dagify/node"; // Alias for "dagify/secure/node"
    ```

- **Unsecure:**
  - **Unsecure Import:**
    ```js
    import dagifyUnsecure from "dagify/unsecure";
    ```
  - **Unsecure Node:**
    ```js
    import nodeUnsecure from "dagify/unsecure/node";
    ```

- **Other Modules:**  
  Additional functionality is exposed via:
  - **Nodes:** `import nodes from "dagify/nodes";`
  - **Graph:** `import graph from "dagify/graph";`
  - **Composite:**
    - Secure (default): `import composite from "dagify/composite";` or `import compositeSecure from "dagify/secure/composite";`
    - Unsecure: `import compositeUnsecure from "dagify/unsecure/composite";`
  - **Operators:** `import operators from "dagify/operators";`

This structure ensures that users receive a secure implementation by default while still having access to unsecure versions when explicitly needed.

---

## Public API Documentation

The following functions are exposed through the public index files. They serve as the primary entry points for users to create and manage reactive nodes, graphs, composites, and perform related operations.

### Node Creation & Management

#### createNode

Creates a new reactive node. This function instantiates a standard reactive node that can be computed (when passed a function) or static.

**Signature**

```js
createNode(fnOrValue, dependencies = [], config)
```

**Parameters**

- **fnOrValue:** A function (for computed nodes) or an initial value (for static nodes).
- **dependencies:** An array (or any list) of dependencies for computed nodes.
- **config:** Optional configuration options.

**Returns**

A new instance of a reactive node.

---

#### createShallowNode

Creates a new shallow reactive node that only emits updates when shallow changes to its value are detected. It uses shallow equality (instead of deep equality) for change detection.

**Signature**

```js
createShallowNode(fnOrValue, dependencies = [], config)
```

**Parameters**

- **fnOrValue:** A function to compute the node’s value (for computed nodes) or a static value.
- **dependencies:** An array or single dependency.
- **config:** Optional configuration options.

**Returns**

A new instance of `ShallowReactiveNode`.

---

#### createBridgeNode

Creates a bridge node that connects an input node to an output node. The bridge node forwards new values from the input node to the output node, with its internal value always reflecting the output node’s current state. Errors during output computation are handled silently.

**Signature**

```js
createBridgeNode(input, output, config = {})
```

**Parameters**

- **input:** The reactive node to which updates are sent.
- **output:** The reactive node whose processed (computed) value is exposed.
- **config:** Optional configuration options.

**Returns**

A new instance of `BridgeNode`.

---

#### createExecutionNode

Creates a new execution node that only emits values when explicitly triggered. In computed mode, the node recomputes its value only when manually triggered (or via an external execution stream), while static nodes simply emit their current value when triggered.

**Signature**

```js
createExecutionNode(fnOrValue, dependencies = [], executionStream, config)
```

**Parameters**

- **fnOrValue:** A function (for computed nodes) or an initial value (for static nodes).
- **dependencies:** Dependencies for computed nodes (positional array or named object). Ignored for static nodes.
- **executionStream:** An optional Observable to control triggering. If not provided, one is created internally.
- **config:** Optional configuration options.

**Returns**

A new instance of `ExecutionNode`.

---

#### batch

Executes multiple updates in batch mode so that subscribers receive only the final update. This is useful for performance optimization when several changes occur together.

**Signature**

```js
batch(fn)
```

**Parameters**

- **fn:** A function containing multiple updates that will be batched.

---

#### nodeFactory

Exports a lazy node creation utility. The node factory returns a Proxy object that lazily creates and manages nodes.

**Usage**

```js
nodeFactory(value, depsOrActivator, max)
```

**Parameters**

- **value:** The base value or function for node creation.
- **depsOrActivator:** For computed nodes, an array (or single dependency) of dependencies; for stateful nodes, an activator function (or a number representing the maximum nodes).
- **max:** Maximum number of nodes to create (default is 1000).

**Returns**

A Proxy object for lazy node management.

---

#### isDagifyNode

A utility to check if an object is a Dagify node.

---

### Graph & Composite

#### createGraph

Creates a new reactive graph instance. The graph manages nodes and the dependencies (edges) between them. It also provides utilities for connecting, disconnecting, and updating nodes in a topological order.

**Signature**

```js
createGraph(config)
```

**Parameters**

- **config:** Optional configuration object for the graph.

**Returns**

A new instance of `ReactiveGraph`.

---

#### createComposite

Creates a composite node from a collection of reactive nodes. The composite’s value is a combination (array or object) of the values of its child nodes.

**Signature**

```js
createComposite(nodes)
```

**Parameters**

- **nodes:** Either an array or an object mapping keys to reactive nodes.

**Returns**

A new composite instance.

---

## API Documentation

This documentation covers the main classes and functions from the following files:

- **Composite.js**
- **ReactiveGraph.js**
- **BridgeNode.js**
- **ExecutionNode.js**
- **nodeFactory.js**
- **ReactiveNode.js**
- **ShallowReactiveNode.js**

---

## Contents

- [Composite](#composite)
- [ReactiveGraph](#reactivegraph)
- [BridgeNode](#bridgenode)
- [ExecutionNode](#executionnode)
- [nodeFactory](#nodefactory)
- [ReactiveNode](#reactivenode)
- [ShallowReactiveNode](#shallowreactivenode)

---

## Examples

### Basic Example: Static and Computed Nodes

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

---

### Advanced Example: Composite and Graph with Batch Updates

This example demonstrates how to build a reactive graph that connects multiple nodes, combine them into a composite, and use batch updates for performance optimization. The composite aggregates multiple nodes, while the graph manages their dependencies and connections.

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

// Connect nodes in the graph: nodeA → nodeB and nodeB → nodeC.
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
```

---

## License

Dagify is released under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Please review our [contributing guidelines](CONTRIBUTING.md) and [code of conduct](CODE_OF_CONDUCT.md) before submitting pull requests.

---

© 2025 Dagify. All rights reserved.