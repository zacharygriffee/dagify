**Prompt: "Working Effectively with Dagify 2.x"**

You are an AI tasked with mastering the Dagify 2.x reactive dependency graph library for JavaScript. Read the core documentation (`readme.md` plus any relevant files in `docs/`) and use the current source as the ground truth. Your deliverable should demonstrate a practical understanding of the API surface and how to compose Dagify with RxJS-style workflows.

### 1. Orient Yourself
- Summarize the role of Dagify’s main entry point (`dagify`) and the purpose of the secondary namespaces (`dagify/graph`, `dagify/composite`, `dagify/shallow`, `dagify/effect`, `dagify/execution`, `dagify/node`, etc.).
- Note that the default export surface includes helpers such as `createNode`, `batch`, `createGraph`, `createComposite`, `createTrigger`, `diffOperator`, and the FRP helpers (`map`, `filter`, `combine`, `merge`, `switchLatest`, `from`, `createStore`).
- Call out where to find advanced utilities like type checking (`dagify/internal/types`) and value encodings (`dagify/internal/encoding`).

### 2. Core Reactive Nodes
- Use `createNode` to produce both a static node and a computed node.
- Emphasize how computed nodes receive dependency values:
  - When you pass an array of dependencies, the compute function receives either a single array argument (if the function’s arity is 1) or spread positional arguments.
  - When you pass an object of dependencies, the compute function receives an object with matching keys.
- Demonstrate subscriptions and static updates:

```js
import { createNode } from "dagify";

const counter = createNode(0);
const doubled = createNode(([value]) => value * 2, [counter]);

const stop = doubled.subscribe(value => {
  console.log("Doubled count:", value);
});

counter.set(1); // logs 2
counter.set(2); // logs 4
stop.unsubscribe();
```

Explain why attempting to call `.set` on a computed node throws, and mention that nodes expose `.value`, `.stream`, `.once`, and `.skip`.

### 3. Stream & FRP Helpers
- Show how Dagify nodes interoperate with RxJS by using `.stream` and FRP helpers imported from `"dagify"`.
- Provide an example that uses `createStore`, `map`, `filter`, `combine`, `merge`, `switchLatest`, and `from` to compose node values and observables:

```js
import { createStore, map, filter, combine, merge, switchLatest, from } from "dagify";
import { interval } from "rxjs";

const count = createStore(0);
const even = filter(count, n => n % 2 === 0);
const doubled = map(count, n => n * 2);

const summary = combine([count, doubled], (c, d) => ({ count: c, doubled: d }));
summary.subscribe(({ count, doubled }) => {
  console.log(`Count ${count} -> doubled ${doubled}`);
});

const slow = from(interval(1000));
const fast = from(interval(250));
const mode = createStore("slow");
const currentStream = map(mode, label => (label === "slow" ? slow : fast));
const latest = switchLatest(currentStream);

const merged = merge([latest, doubled]);
merged.subscribe(value => console.log("Merged emission:", value));
```

Mention that the FRP helpers accept nodes or observables, return Dagify nodes, and interoperate with RxJS pipelines via `.stream`.

### 4. Batched Updates
- Demonstrate how `batch` collapses multiple `.set` calls into a single emission:

```js
import { batch, createNode } from "dagify";

const batched = createNode(0);
batched.subscribe(value => console.log("Batched value:", value));

batch(() => {
  batched.set(1);
  batched.set(2);
  batched.set(3);
}); // emits 3 once
```

Clarify that batching is global and affects all Dagify nodes updated inside the callback.

### 5. Shallow Reactive Nodes
- Explain when to reach for `createShallowNode` (or `createNode` with `{ shallow: true }`) to avoid deep comparisons.
- Show how shallow comparison only reacts when the top-level reference changes:

```js
import { createShallowNode } from "dagify/shallow";

const settings = createShallowNode({ theme: "dark", flags: { beta: false } });
settings.subscribe(value => console.log("Shallow value:", value));

const state = settings.value;
state.flags.beta = true;
settings.set(state); // no emission; same top-level object

settings.set({ ...state, flags: { ...state.flags, beta: true } }); // emits; new reference
```

Highlight that shallow nodes still support computed dependencies by passing Dagify nodes as dependencies.

### 6. Composites
- Use `createComposite` to aggregate multiple nodes in both array and object form:

```js
import { createComposite, createNode } from "dagify";

const width = createNode(100);
const height = createNode(200);
const area = createNode(([w, h]) => w * h, [width, height]);

const layout = createComposite({ width, height, area });
layout.subscribe(current => console.log("Layout snapshot:", current));

const palette = createComposite([createNode("red"), createNode("blue")]);
palette.subscribe(colors => console.log("Palette:", colors));
```

Mention that composites emit when any child node emits and retain the original structure.

### 7. Working with Graphs
- Illustrate the graph lifecycle: `createGraph`, `addNode`, `connect`, `disconnect`, `removeNode`, `update`, and `updateAsync`.
- Demonstrate introspection helpers like `getNode`, `getNodes`, `getImmediatePredecessors`, `getSuccessors`, `getSources`, `getSinks`, `createsCycle`, `findPath`, and `topologicalSort`.
- Remember that graph keys are binary. Show how to convert them to readable ids via `graph.getNode(key).id`:

```js
import { createGraph, createNode } from "dagify";

const graph = createGraph();
const temperature = createNode(20);
const fahrenheit = createNode(value => value * 1.8 + 32, [temperature]);

graph.addNodes([temperature, fahrenheit]);
graph.connect(temperature, fahrenheit);

const order = graph.topologicalSort().map(key => graph.getNode(key).id);
console.log("Topo order:", order);
console.log("Predecessors:", graph.getImmediatePredecessors(fahrenheit).map(node => node.id));
```

Explain that computed nodes in a graph automatically manage dependencies when connected, and that `createsCycle` guards against invalid edges.

### 8. Effect Namespace (Side Effects & Bridging)
- Detail what lives under `dagify/effect`: `effect.command`, `effect.bridge`, `effect.sink`, `effect.fromEvent`, `effect.dispatcher`, and the direct exports (`command`, `bridge`, `sink`, etc.).
- Provide a bridge example that forwards writes into an input node and exposes the processed output:

```js
import { createNode } from "dagify";
import { bridge } from "dagify/effect";

const input = createNode(1);
const output = createNode(([value]) => value * 10, [input]);
const bridgeNode = bridge(input, output);

bridgeNode.subscribe(value => console.log("Bridge output:", value));
bridgeNode.set(5).then(() => console.log("Bridge recomputed"));
```

- Mention how commands (`effect.command`) encapsulate side-effectful handlers, sinks (`effect.sink`) react to upstream values, and `dispatcher` can broadcast payloads to command nodes.

### 9. Execution Nodes
- Use `createExecutionNode` when you need manual control over emissions. Show both manual triggering and external stream triggering:

```js
import { createNode } from "dagify";
import { createExecutionNode } from "dagify/execution";
import { Subject } from "rxjs";

const source = createNode(3);
const manual = createExecutionNode(([value]) => value * 2, [source]);
manual.subscribe(value => console.log("Manual emission:", value));

manual.triggerExecution(); // logs 6
source.set(4);
manual.triggerExecution(); // logs 8

const trigger$ = new Subject();
const streamDriven = createExecutionNode(([value]) => value + 1, [source], trigger$);
streamDriven.subscribe(value => console.log("Stream execution:", value));
trigger$.next(); // logs 5
```

Note that execution nodes suppress automatic dependency updates and only emit when explicitly triggered.

### 10. Lazy Node Factories
- Show how `nodeFactory` (from `dagify/node`) lazily creates nodes on demand. Cover both computed and stateful usage:

```js
import { createNode } from "dagify";
import { nodeFactory } from "dagify/node";

const base = createNode(1);
const extra = createNode(2);

const computedFactory = nodeFactory(
  ([a, b]) => a + b,
  [base, extra],
  5 // optional max for iterator
);

const sumNode = computedFactory.total;
sumNode.subscribe(value => console.log("Sum:", value)); // logs 3
base.set(5); // logs 7

const stateFactory = nodeFactory({ status: "idle" }, (id, node) => {
  console.log(`Activated ${id}`, node.id);
});

const taskNode = stateFactory.download;
taskNode.set({ status: "running" });

for (const node of computedFactory) {
  console.log("Iterated node:", node.value);
  break; // avoid infinite iteration
}

computedFactory.clear(); // removes cached nodes
```

Clarify that computed factories treat the second argument as dependencies, whereas stateful factories treat it as an activator callback.

### 11. Wrap-Up Reflection
- Conclude with insights on how Dagify’s pieces fit together (nodes, composites, graphs, FRP helpers, effect layer, execution nodes, lazy factories).
- Identify realistic scenarios where Dagify shines, potential pitfalls (e.g., forgetting to replace references when using shallow nodes, triggering execution nodes), and testing strategies you would apply when integrating Dagify into larger systems.

Use the current Dagify source as the authoritative reference for behavior and surface area. All explanations and code samples should match Dagify 2.x as implemented in this repository.
