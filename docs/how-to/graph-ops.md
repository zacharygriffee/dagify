# Graph Lifecycle & Operations

How to build, connect, and inspect Dagify graphs.

## Create and populate a graph

```js
import { createGraph, createNode } from "dagify";

const graph = createGraph();
const celsius = createNode(20);
const fahrenheit = createNode(([value]) => value * 1.8 + 32, [celsius]);

graph.addNodes([celsius, fahrenheit]);
graph.connect(celsius, fahrenheit);
```

- `addNodes` accepts individual nodes or arrays; it assigns internal binary keys.
- Edges are directional: `connect(from, to)` wires emissions from `from` into `to`.

## Update and recompute

- `update()` walks the graph in topological order and calls `update()` on computed nodes.
- `updateAsync()` does the same but awaits async computations.
- You rarely need these for standard computed nodes because dependencies trigger updates automatically, but they help when manually coordinating execution nodes.

## Edit topology safely

- `disconnect(from, to)` removes an edge without removing nodes.
- `removeNode(node)` detaches the node and its edges.
- Use `createsCycle(from, to)` before `connect` to prevent invalid edges.

## Introspect

```js
const keys = graph.topologicalSort();
const order = keys.map(key => graph.getNode(key).id);
const preds = graph.getImmediatePredecessors(fahrenheit).map(n => n.id);
const succs = graph.getSuccessors(celsius).map(n => n.id);
const path = graph.findPath(celsius, fahrenheit);
```

- `getSources()` / `getSinks()` return nodes with no inbound/outbound edges.
- `findPath(a, b)` helps explain unexpected emissions by showing the chain between nodes.

## Cleanup

- Call `removeNode` (and `disconnect` as needed) when tearing down modules to keep introspection accurate.
- If nodes attach timers or external subscriptions, call `complete()` before dropping references.
