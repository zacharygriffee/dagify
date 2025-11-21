# Execution & Queued Nodes

Manual and ordered execution helpers.

## `createExecutionNode` (`dagify/execution`)

Create a node whose computation only runs when explicitly triggered.

```js
import { createNode } from "dagify";
import { createExecutionNode } from "dagify/execution";
import { Subject } from "rxjs";

const source = createNode(3);
const manual = createExecutionNode(([value]) => value * 2, [source]);
manual.subscribe(console.log);

manual.triggerExecution(); // 6
source.set(4);
manual.triggerExecution(); // 8

const trigger$ = new Subject();
const streamDriven = createExecutionNode(([value]) => value + 1, [source], trigger$);
streamDriven.subscribe(console.log);
trigger$.next(); // 5
```

- Suppresses automatic dependency-driven recomputation; you decide when to emit.
- Useful for expensive recomputations, user-driven “refresh”, or externally clocked pipelines.

## `createQueuedNode` (`dagify` root)

Serialize async work so every payload completes in order.

```js
import { createNode, createQueuedNode } from "dagify";

const input = createNode(0);
const sequenced = createQueuedNode(async value => {
  await doWork(value);
  return value;
}, input);

sequenced.subscribe(v => console.log("done", v));
input.set(2);
input.set(1);
// emits 2 then 1 in that order, even if work(1) finishes first
```

Options (via node config):
- `maxQueueLength`: bound the internal queue.
- `overflowStrategy`: `"drop-newest"` (default), `"drop-oldest"`, or `"error"`.
- `onOverflow`: hook invoked when the queue is full; return `"enqueue"` to override the strategy.
