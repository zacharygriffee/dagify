**Prompt: "Mastering Dagify: A Comprehensive Guide to Reactive Dependency Graphs"**

You are an AI tasked with learning and demonstrating the use of Dagify, a reactive dependency graph library for JavaScript. Your objective is to build a deep understanding of the library’s features and apply them to construct a dynamic, reactive system. Follow these steps and answer all parts of the task.

### 1. Introduction to Dagify
- **Overview:**  
  Begin by reading the library’s documentation. Understand that Dagify lets you create both static and computed nodes, compose nodes into composites, build reactive graphs, and even perform network synchronization. It supports lazy node creation, batched updates, and both deep and shallow equality checks.

- **Key Concepts:**
    - **ReactiveNode:** The core building block that represents a unit of reactive state.
    - **Computed vs. Static Nodes:** Computed nodes derive their values from dependencies using a function, while static nodes hold constant values.
    - **Composite:** A node that aggregates multiple reactive nodes.
    - **Graph:** A structure that manages nodes and their interdependencies.
    - **Advanced Nodes:** BridgeNode (for linking input/output) and ExecutionNode (for manual triggering).
    - **Utilities:** Batch updates and nodeFactory for lazy creation.

### 2. Basic Node Creation
- **Task:**  
  Use `createNode` to create a static node and a computed node.

- **Instructions:**
    - Create a static node that holds a simple number (e.g., `42`).
    - Create a computed node that calculates the double of the static node’s value.

- **Code Example:**
  ```js
  import { createNode } from "dagify"; // assume dagify is imported correctly

  // Static node holding a number
  const staticNode = createNode(42);

  // Computed node that depends on staticNode
  const computedNode = createNode(
    (deps) => deps[0] * 2, 
    [staticNode]
  );

  // Subscribe to changes
  computedNode.subscribe((value) => {
    console.log("Computed Value:", value);
  });
  ```
- **Reflection:**  
  Explain how the computed node automatically recalculates when `staticNode` changes.

### 3. Using Shallow Reactive Nodes
- **Task:**  
  Create a shallow reactive node using `createShallowNode` that updates only on shallow changes.

- **Instructions:**
    - Create a shallow node that computes a value based on an object.
    - Demonstrate how updating nested properties without changing the object reference does not trigger an emission.

- **Code Example:**
  ```js
  import { createShallowNode } from "dagify";

  const baseObj = { a: 1, b: 2 };
  const shallowNode = createShallowNode(
    (deps) => deps[0], 
    [baseObj]
  );

  shallowNode.subscribe((value) => {
    console.log("Shallow Node Value:", value);
  });

  // Update the object shallowly (by reference it stays the same)
  baseObj.a = 10;
  // This should not trigger a new emission since the reference hasn't changed.
  ```

### 4. Composing Nodes with Composite
- **Task:**  
  Create a composite node that aggregates multiple reactive nodes.

- **Instructions:**
    - Combine several static and computed nodes into a composite.
    - Observe how the composite’s value reflects the state of its children.

- **Code Example:**
  ```js
  import { createComposite, createNode } from "dagify";

  const node1 = createNode(10);
  const node2 = createNode((deps) => deps[0] + 5, [node1]);
  const node3 = createNode(20);

  // Composite using an array
  const composite = createComposite([node1, node2, node3]);

  composite.subscribe((values) => {
    console.log("Composite Value:", values);
  });
  ```

### 5. Building and Manipulating a Reactive Graph
- **Task:**  
  Construct a reactive graph using `createGraph` and connect several nodes.

- **Instructions:**
    - Create multiple nodes and add them to a graph.
    - Connect nodes to form dependencies.
    - Use methods like `getImmediatePredecessors` and `topologicalSort` to analyze the graph.

- **Code Example:**
  ```js
  import { createGraph, createNode } from "dagify";

  const graph = createGraph();

  const n1 = createNode(5);
  const n2 = createNode((deps) => deps[0] * 3, [n1]);
  const n3 = createNode((deps) => deps[0] - 2, [n2]);

  // Add nodes to the graph
  graph.addNode(n1);
  graph.addNode(n2);
  graph.addNode(n3);

  // Connect nodes: n1 -> n2 -> n3
  graph.connect(n1, n2);
  graph.connect(n2, n3);

  // Inspect graph: Get topological sort
  const sortedKeys = graph.topologicalSort();
  console.log("Topologically Sorted Keys:", sortedKeys);
  ```

### 6. Advanced Node Types: Bridge and Execution Nodes
- **BridgeNode Task:**
    - Create an input node and an output node.
    - Use `createBridgeNode` to connect them and show how an update on the input reflects on the output.

- **ExecutionNode Task:**
    - Create an execution node that computes a value only when triggered.
    - Manually trigger the execution and observe the update.

- **Code Example:**
  ```js
  import { createBridgeNode, createNode, createExecutionNode } from "dagify";
  import { Subject } from "rxjs";

  // BridgeNode example
  const inputNode = createNode(1);
  const outputNode = createNode((deps) => deps[0] + 10, [inputNode]);
  const bridge = createBridgeNode(inputNode, outputNode);

  bridge.subscribe((value) => {
    console.log("Bridge Node Value:", value);
  });
  // Update via bridge
  bridge.set(5);

  // ExecutionNode example
  const execStream = new Subject();
  const execNode = createExecutionNode(
    (deps) => deps[0] * 2, 
    [inputNode], 
    execStream
  );
  execNode.subscribe((value) => {
    console.log("Execution Node Value:", value);
  });
  // Trigger execution manually
  execNode.triggerExecution();
  ```

### 7. Batch Updates for Performance
- **Task:**  
  Use the `batch` function to group multiple updates so that subscribers receive only one final update.

- **Instructions:**
    - Perform several changes to a set of nodes within a batch.
    - Compare this with updating nodes individually.

- **Code Example:**
  ```js
  import { createNode, batch } from "dagify";

  const batchNode = createNode(0);
  batchNode.subscribe((value) => {
    console.log("Batched Node Value:", value);
  });

  // Without batching, multiple emissions occur
  batchNode.set(1);
  batchNode.set(2);

  // With batching, only the final value is emitted
  batch(() => {
    batchNode.set(3);
    batchNode.set(4);
    batchNode.set(5);
  });
  ```

### 8. Lazy Node Creation with nodeFactory
- **Task:**  
  Experiment with the `nodeFactory` utility to lazily create nodes on demand.

- **Instructions:**
    - Create a factory for computed nodes.
    - Access properties on the returned Proxy to generate nodes.
    - Iterate over the factory to create a sequence of nodes.

- **Code Example:**
  ```js
  import { nodeFactory } from "dagify";

  // Computed node factory: Sum of dependencies
  const computedFactory = nodeFactory(
    (deps) => deps.reduce((sum, node) => sum + node.value, 0),
    [createNode(1), createNode(2)],
    10 // max nodes
  );

  // Access a node lazily
  const myNode = computedFactory.someKey;
  myNode.subscribe((value) => {
    console.log("Lazy Node Value:", value);
  });

  // Iterate over the factory to create sequential nodes
  for (const node of computedFactory) {
    console.log("Iterated Node Value:", node.value);
    // Use break to avoid infinite iteration
    break;
  }
  ```

**Final Reflection:**  
At the end of this tutorial, summarize what you learned about Dagify. Describe how the various components (nodes, composites, graphs, advanced nodes, and utilities) work together to create robust reactive systems. Provide insights into potential applications and any challenges you foresee when integrating Dagify into larger projects.

This comprehensive prompt should equip you with both the theoretical understanding and practical coding examples needed to effectively use Dagify. Happy coding!
