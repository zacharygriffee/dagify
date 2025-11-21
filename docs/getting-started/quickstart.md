# Quickstart

Get Dagify installed, create your first nodes, and plug into FRP helpers.

## Install

```bash
npm install dagify
```

## Create state and computed nodes

```js
import { createNode } from "dagify";

const count = createNode(0);
const doubled = createNode(([value]) => value * 2, [count]);

const stop = doubled.subscribe(value => {
  console.log("Doubled:", value);
});

count.set(1); // logs 2
count.set(3); // logs 6
stop.unsubscribe();
```

Dependency shapes:
- Arrays pass values either as a single array argument (if your function takes one param) or as spread positional args (if it takes more).
- Objects pass a keyed object that mirrors the dependency shape.

## Compose with FRP helpers

```js
import { createStore, map, filter, combine, merge, from, switchLatest } from "dagify";
import { interval } from "rxjs";

const clicks = createStore(0);
const evenClicks = filter(clicks, n => n % 2 === 0);
const doubled = map(clicks, n => n * 2);

const summary = combine([evenClicks, doubled], (even, d) => ({ even, doubled: d }));
summary.subscribe(console.log);

const slow = from(interval(1000));
const fast = from(interval(250));
const mode = createStore("slow");
const latest = switchLatest(map(mode, m => (m === "slow" ? slow : fast)));
merge([latest, doubled]).subscribe(value => console.log("Merged:", value));
```

## Effects at the edge

```js
import { bridge, command } from "dagify/effect";

const source = createNode(1);
const output = createNode(([v]) => v * 10, [source]);
const bus = bridge(source, output);

bus.subscribe(value => console.log("Bridge output:", value));
await bus.set(5); // recomputes output

const updateUser = command("@user/update", payload => api.update(payload), {
  disableBatching: false, // allow coalescing rapid-fire events
});
```

## Next steps
- Concepts: `../concepts/` for dependency shapes, batching, NO_EMIT, shallow vs deep, and type/encoding behavior.
- How-to: `../how-to/` for RxJS/Svelte interop, diff operator, activity thresholding, and side-effect patterns.
- Reference: `../reference/` for command/bridge/filter/sink/trigger/event nodes and encoding/type helpers.
- Guides: `../guides/` for migration notes and Dagify vs RxJS positioning.
- Best practices: `../best-practices.md` and `../observability-and-debugging.md` for modeling, reliability, and debugging tips.
