## Sink Node

The `sink` helper (exposed via `dagify/effect`) creates a specialized reactive node intended to serve as a terminal consumer for side effects. Unlike typical computed nodes, a sink node is designed to react to upstream changes by executing side effects (such as logging, writing to a socket, or triggering external APIs) without being used as a dependency for further computations.

Sink nodes are ideal when you want to isolate side effects from your pure data transformations. They can have dependencies (so they can react to changes) but must never be wired as inputs for another computed node.

### Function Signature

```js
sink(fnOrValue, dependencies, config)
```

### Parameters

- **`fnOrValue`**: `Function | *`  
  A function that defines the computed behavior (side effect) for the node or a static value. When a function is provided, it will be called with the resolved dependency values.

- **`dependencies`**: *(Optional)*  
  The dependencies for the sink node. This can be a single dependency, an array of dependencies, or an object mapping keys to dependencies. These dependencies allow the sink node to react to changes in upstream values and trigger the corresponding side effect.

- **`config`**: `Object` (Optional)  
  Additional configuration options for the node. Any options accepted by the underlying `createNode` function can be passed here. This function automatically sets the `sink` flag to `true` to mark the node as a terminal consumer.  
  Example configuration:
  ```js
  {
    disableBatching: false,
    // other config options...
  }
  ```

### Returns

- **`ReactiveNode`**  
  The created sink node. This node is marked as a sink, meaning:
    - It can subscribe to dependencies and execute its function (i.e., perform side effects) when those dependencies change.
    - It is not allowed to be used as a dependency in other computed nodes, ensuring that side effects remain isolated.

### Example Usage

```js
import { sink } from "dagify/effect";
import { createNode } from "dagify";

// Create a dependency node
const dependencyNode = createNode(10);

// Create a sink node that logs the dependency's value to the console when updated.
const loggerSink = sink(
  ([value]) => {
    console.log("Dependency updated:", value);
  },
  [dependencyNode]
);

// Trigger the sink node computation manually (if not auto-triggered by your implementation)
loggerSink.update();

// Later, update the dependency to see the side effect executed again.
dependencyNode.set(42);
loggerSink.update();
```

### Design Considerations

- **Side-Effect Isolation:**  
  Sink nodes allow you to keep side effects isolated from your pure computation graph. They listen to upstream changes and execute the provided function solely for side effects.

- **Terminal Behavior:**  
  While a sink node can have dependencies, it should not be used as a dependency for other computed nodes. This ensures that the side effects are terminal and do not inadvertently affect further data flows.

- **Subscription Behavior:**  
  To maintain clarity and enforce separation, the implementation is designed to discourage (or prevent) subscribers from attaching to sink nodes for further computations.
