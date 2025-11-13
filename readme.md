# Dagify Core API

Dagify is a reactive dependency graph library designed for powerful state management and reactive computation. This guide covers the core API for creating and managing reactive nodes, graphs, and composites.

Looking for details on specific node types or advanced topics? Dive into the docs:
- [Activity Thresholding](docs/activity-thresholding.md)
- [Command Nodes](docs/command-node.md)
- [Bridge Nodes](docs/bridge-node.md)
- [Encoding & Types](docs/encodings.md), [types](docs/types.md)
- [Triggers & Effects](docs/trigger-node.md), [side effects](docs/side-effects.md)
- [Migration](docs/migration-2.0.md)

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

### 5. **Serializing Async Work with Queued Nodes**

Use `createQueuedNode` when a computed node performs asynchronous work and you need every transition to finish before the next one begins. Each dependency change (or direct `set`) is snapshotted and processed sequentially, so downstream consumers always see ordered results even if the underlying promise/observable resolves out of order.

```js
import { createNode, createQueuedNode } from 'dagify';

const input = createNode(0);
const sequenced = createQueuedNode(async (value) => {
  // Simulate variable latency per payload.
  const wait = value === 40 ? 50 : value === 30 ? 5 : 0;
  await new Promise(resolve => setTimeout(resolve, wait));
  return value;
}, input);

sequenced.subscribe(value => console.log('processed', value));

input.set(40);
input.set(30);
input.set(10);
// Logs: processed 40, processed 30, processed 10
```

Because the node uses an internal queue, rapid fire updates can build backpressure. If you expect bursty traffic, consider gating input or sharding across multiple queued nodes.

#### Managing Backpressure

Queued nodes can optionally bound their internal queue. Pass a `maxQueueLength` together with an `overflowStrategy` to decide what happens when new payloads arrive faster than the async work can finish.

```js
const throttled = createQueuedNode(fetchProfile, requests, {
  maxQueueLength: 2,
  overflowStrategy: "drop-oldest", // or "drop-newest" / "error"
  onOverflow: ({ strategy, queueLength }) => {
    console.warn(`queue is ${queueLength} deep, applying ${strategy}`);
  }
});
```

When the queue is full:
- `drop-newest` (default) ignores the incoming payload.
- `drop-oldest` evicts the oldest pending snapshot so the new one can run.
- `error` propagates an overflow error through the node.

The `onOverflow` callback runs every time the queue is full and can return `"enqueue"` to override the strategy and accept the payload anyway.

---

## License

MIT License © 2025 Zachary Griffee
