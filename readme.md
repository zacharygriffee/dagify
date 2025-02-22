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

### Dispatcher and Event Nodes

Dagify now includes a new IPC-inspired dispatcher module that serves as a centralized event router for reactive applications. This component—often referred to as the **dispatcher** or **event dispatcher**—allows you to emit and listen for events across the entire dependency graph. In tandem with the dispatcher, the `createEventNode` function lets you create reactive event nodes that automatically update when their corresponding event is dispatched.

#### Key Features

- **Centralized Event Routing:**  
  The dispatcher acts as a global router, delivering events to any node that subscribes to a specific event name. This decouples event emitters from consumers, making your architecture more modular and IPC-like.

- **Context Support (Future-Proofed):**  
  Although events are dispatched in a global context by default, the API supports an optional context parameter. This allows you to later segment events (for example, by application or graph scope) without changing how nodes subscribe to them.

- **Flexible Default Values:**  
  When creating an event node with `createEventNode`, you can provide a default value. If no event has yet been emitted, the node maintains this default state. This is useful when a node’s behavior should not be triggered until a valid event occurs.

- **Seamless Integration with Computed Nodes:**  
  Since event nodes are just reactive nodes, they can serve as dependencies for computed nodes. For example, a computed node can add a static value to the payload from an event node—even if that event carries no information (acting purely as a trigger).

#### API Overview

- **Dispatcher**

  The dispatcher module provides a simple API to emit and subscribe to events:

  ```js
  import { dispatcher } from "dagify";

  // Emit an event (optionally specifying a context)
  dispatcher.emit("eventName", payload, "context");

  // Subscribe to an event
  dispatcher.on("eventName", (payload) => {
    console.log("Received payload:", payload);
  }, "context");
  ```

- **createEventNode**

  The `createEventNode` function creates a reactive event node that listens for events dispatched by the dispatcher.

  **Signature:**

  ```js
  createEventNode(eventName, defaultValue, context)
  ```

  **Parameters:**

  - `eventName` – A string that identifies the event.
  - `defaultValue` – (Optional) The initial value for the node if no event has been received.
  - `context` – (Optional) The context within which the event should be listened for (defaults to `"global"`).

  **Example:**

  ```js
  import { createNode, createEventNode, dispatcher } from "dagify";

  // Create an event node that listens for the "hello" event.
  const helloEvent = createEventNode("hello", 0);

  // Create a computed node that uses the event node.
  const logNode = createNode(
    ([trigger]) => console.log("Triggered with value:", trigger),
    [helloEvent]
  );

  // Initially, logNode sees the default value (0).
  // When the event is dispatched, it updates:
  dispatcher.emit("hello", 42);
  // Expected output: "Triggered with value: 42"
  ```

This new dispatcher and event node model provides a robust, IPC-like mechanism to trigger and route events within your reactive graphs. It lays the groundwork for more advanced features (like context-based event segmentation) while keeping the API simple and consistent with Dagify’s overall design.

Below is an addition you can include in your README to explain the dispatcher integration with Command Nodes:

---

### Dispatcher & Command Nodes

Dagify now supports **Command Nodes**—specialized reactive nodes designed for processing external commands. While event nodes simply propagate payloads, command nodes go one step further: they validate, filter, and process incoming data using a custom handler, and then emit the resulting state downstream.

#### Key Features

- **Integrated Processing Pipeline:**  
  Command nodes can be configured with a **validator** to ensure that only valid data is processed, a **filter** to transform incoming payloads, and a **handler** to execute your business logic. The result of the handler becomes the node’s state.

- **Asynchronous Support:**  
  Handlers can be synchronous or asynchronous. If a handler returns a Promise, the node waits for resolution before updating its state.

- **Automatic Dispatcher Binding:**  
  Command nodes are automatically bound to a dispatcher (or event router). This allows the node to be triggered whenever an external command is emitted on the network.

- **Explicit Context Routing:**  
  The command’s context (e.g. `"global"` or a custom namespace) is specified as a separate parameter—distinct from other configuration options—so that routing behavior is clear and consistent with event node creation.

#### Creating a Command Node

You can create and bind a Command Node using the `createCommandNode` factory function. This function automatically registers the command with the dispatcher so that when a command (e.g., `"@player/position"`) is emitted, the node is triggered with the provided payload.

**Example:**

```js
import { dispatcher, CommandNode } from "dagify";

// Example usage:

// Define a validator to ensure the command payload conforms to the expected structure.
// this errors if it doesn't succeed. Use filter to complete filter out payloads that don't conform
// before it reaches the validator.
const validator = (data) => {
  if (typeof data.x !== "number" || typeof data.y !== "number") {
    return { valid: false, error: new Error("Invalid vector2 format") };
  }
  return { valid: true };
};

// Optional map to round incoming numbers.
const map = (data) => ({ x: Math.round(data.x), y: Math.round(data.y) });

// A command handler that calculates the magnitude of a vector.
const handler = async (data) => {
  return Math.sqrt(data.x * data.x + data.y * data.y);
};

// Create and bind a command node for the "@player/position" command.
const playerPositionNode = createCommandNode("@player/position", handler, { validator, map });

// When the dispatcher emits the "@player/position" command with a valid payload,
// the playerPositionNode processes the payload and its subscribers receive the computed result.
dispatcher.emit("@player/position", { x: 3.2, y: 4.7 });
```

#### Summary

By using Command Nodes together with a dispatcher, your system can:

- **Validate and process external commands** before integrating them into your reactive graph.
- **Keep business logic encapsulated** within nodes, ensuring that only valid, transformed data is propagated downstream.
- **Maintain clear routing and modularity** via explicit command names and contexts.

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