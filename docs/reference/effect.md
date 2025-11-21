# Effect Namespace (`dagify/effect`)

Helpers for boundaries where Dagify meets the outside world.

## Exports

```js
import {
  effect,
  command,
  bridge,
  sink,
  fromEvent,
  trigger,
  createTrigger,
  dispatcher,
  invokeOnNode,
} from "dagify/effect";
```

- `command(commandName, handler, options?)`: wraps a handler (sync/async) as a command node. Supports `{ validator, map, disableBatching }`.
- `bridge(inputNode, outputNode)`: forwards writes into `inputNode` and emits `outputNode` after recompute; useful for request/response patterns.
- `sink(projector)`: runs side-effects on upstream emissions and emits the same value (unless you return `NO_EMIT`).
- `fromEvent(eventName, defaultValue?, context?)`: attaches to the shared dispatcher and emits whenever that event is dispatched.
- `trigger` / `createTrigger`: standalone trigger nodes for imperative kicks.
- `dispatcher`: shared event bus used by commands/triggers.
- `invokeOnNode(node, method, ...args)`: call a method on a node (or observable) and emit results; handy for bridges to external systems.
- `effect` namespace mirrors the same helpers as properties (`effect.command`, `effect.bridge`, etc.).

## Command batching/backpressure

- `disableBatching` defaults to `true` (no coalescing). Set `false` to allow lossy coalescing during bursts.
- For strict ordering with async handlers, use `createQueuedNode` upstream so every payload is processed in sequence.

## Example

```js
import { createNode } from "dagify";
import { command, bridge, dispatcher } from "dagify/effect";

const payloads = createNode("");
const processed = createNode(([value]) => value.trim(), [payloads]);
const apiBridge = bridge(payloads, processed);

const updateUser = command("@user/update", async payload => {
  await api.call(payload);
  return { ok: true };
}, { disableBatching: false });

dispatcher.next({ commandName: "@user/update", payload: { id: 1 } });
apiBridge.subscribe(console.log);
```
