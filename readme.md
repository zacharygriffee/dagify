# Dagify Core API

Dagify is a reactive dependency graph library designed for powerful state management and reactive computation. This guide covers the core API for creating and managing reactive nodes, graphs, and composites.

> Extensive documentation is coming soon for all the node types that exist. For now check out the tests for advanced stuff.

## Installation

```bash
npm install dagify
```

---

## Top-Level Imports

The root `dagify` entry now focuses on the FRP essentials:

```js
import {
  createNode,
  batch,
  NO_EMIT,
  createGraph,
  createComposite,
  trigger,
  createTrigger,
  diffOperator,
  takeUntilCompleted,
  map,
  filter,
  combine,
  merge,
  switchLatest,
  from,
  createStore
} from "dagify";
```

Need something more specialized (bridge nodes, command nodes, shallow nodes, encoders, etc.)?  
Import from the dedicated subpath instead:

```js
import { bridge, command, sink } from "dagify/effect";
import { createShallowNode } from "dagify/shallow";
import { nodeFactory } from "dagify/node";
```

---

## Streaming Helpers

- Every node exposes a `.stream` getter that returns an RxJS observable, making it easy to plug Dagify into existing FRP flows.
- The FRP helper functions (`map`, `filter`, `combine`, `merge`, `switchLatest`, `from`, `createStore`) operate on nodes or observables and return new Dagify nodes.

```js
const counter = createStore(0);
const doubled = map(counter, n => n * 2);
const evenDoubled = filter(doubled, n => n % 2 === 0);

evenDoubled.stream.subscribe(value => {
  console.log("Even doubled value:", value);
});

counter.set(1); // filtered out
counter.set(2); // logs 4
```

Need to merge multiple streams?

```js
const total = combine([nodeA, nodeB], (a, b) => a + b);
const merged = merge([updates$, nodeC]);      // observables or nodes
const latest = switchLatest(selector$, inner => inner);
const remote = from(fetch("/api/user"));      // wrap a promise/observable into a node
```

---

## Effect Helpers

Side-effect oriented nodes now live under `dagify/effect`:

```js
import { effect } from "dagify/effect";

const log = effect.sink(value => console.log("Log:", value));
const dispatcher = effect.dispatcher;

const command = effect.command("@user/update", payload => {
  // ...side-effect logic
  return payload;
});

const bridge = effect.bridge(inputNode, outputNode);
const manual = effect.createTrigger();
```

Each helper still returns Dagify nodes, so you can mix them with the FRP utilities above.

---

## Advanced Utilities

Need lower-level primitives such as type registries, encoders, or key-management hooks? Import them from the internal namespace:

```js
import { types } from "dagify/internal/types";
import { setEncoding } from "dagify/internal/encoding";
import { currentKeyGenerator } from "dagify/internal/key-management";
```

These APIs remain available for advanced scenarios while keeping the main surface focused on FRP flows.

---

## Migration

Coming from 1.x? See [`docs/migration-2.0.md`](docs/migration-2.0.md) for a summary of breaking changes and update steps.

---

## Basic Usage

### 1. **Creating a Node**

Use `createNode` to create a reactive node that can hold and update a value.

#### Example

```js
import { createNode } from 'dagify';

// Create a simple reactive node
const node = createNode(10);

// Subscribe to changes
node.subscribe(value => {
  console.log('Node value:', value);
});

// Update the node value
node.set(20);
```

---

### 2. **Creating a Computed Node**

You can create nodes that depend on other nodes and automatically recompute when dependencies change.

#### Example

```js
import { createNode } from 'dagify';

// Create base nodes
const a = createNode(2);
const b = createNode(3);

// Create a computed node that reacts to changes in `a` and `b`
const sum = createNode(([a, b]) => a + b, [a, b]);

// Subscribe to the computed node
sum.subscribe(value => {
  console.log('Sum:', value);
});

// Change values and trigger recomputation
a.set(5); // Sum will automatically update to 8
```

---

### 3. **Creating a Graph**

Use `createGraph` to initialize a reactive dependency graph for managing multiple interconnected nodes.

#### Example

```js
import { createGraph, createNode } from 'dagify';

// Create a new graph
const graph = createGraph();

// Add nodes to the graph
const nodeA = createNode(10);
const nodeB = createNode(20);
const nodeSum = createNode(([a, b]) => a + b);

graph.addNodes([nodeA, nodeB, nodeSum]);
graph.connect([nodeA, nodeB], nodeSum);

// Subscribe to the sum node
nodeSum.subscribe(value => {
  console.log('Graph sum:', value);
});

// Trigger an update
nodeA.set(30);
```

---

### 4. **Creating a Composite**

Use `createComposite` to group multiple nodes together and emit a combined value when any of them change.

#### Example (Object Mode)

```js
import { createNode, createComposite } from 'dagify';

// Create individual nodes
const width = createNode(100);
const height = createNode(200);

// Create a composite node
const dimensions = createComposite({ width, height });

// Subscribe to composite changes
dimensions.subscribe(({ width, height }) => {
  console.log(`Dimensions: ${width}x${height}`);
});

// Update width
width.set(150);
```

#### Example (Array Mode)

```js
const color1 = createNode('red');
const color2 = createNode('blue');

const palette = createComposite([color1, color2]);

palette.subscribe(colors => {
  console.log('Current palette:', colors);
});

// Change a color
color2.set('green');
```

---

## License

MIT License © 2025 Zachary Griffee
