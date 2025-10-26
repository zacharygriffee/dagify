# Dagify 2.0 Migration Guide

Dagify 2.0 reshapes the public surface to focus on a lightweight, FRP-friendly core. This guide highlights the notable changes and how to update existing code.

## Top-Level Imports

- The root `dagify` export now exposes only the core building blocks (`createNode`, `createGraph`, `createComposite`, batching helpers, FRP utilities, etc.).
- Advanced utilities (bridge, command, sink, shallow nodes, encoding, types) live under dedicated subpaths.

| 1.x Import                                    | 2.0 Replacement                         |
|----------------------------------------------|-----------------------------------------|
| `import { createBridgeNode } from "dagify";` | `import { bridge } from "dagify/effect";` |
| `import { createCommandNode } from "dagify";`| `import { command } from "dagify/effect";` |
| `import { createShallowNode } from "dagify";`| `import { createShallowNode } from "dagify/shallow";` |
| `import { nodeFactory } from "dagify";`      | `import { nodeFactory } from "dagify/node";` |

> The legacy paths remain temporarily for compatibility, but new code should use the scoped modules.

## FRP Helpers

New helpers encapsulate common stream transformations:

- `map`, `filter`, `combine`, `merge`, `switchLatest`
- `from` (wraps promises or observables as nodes)
- `createStore` (alias for a simple stateful node)
- Every node now exposes `.stream` for plug-and-play observable interop.

**Example**

```js
import { createStore, map, filter, combine } from "dagify";

const counter = createStore(0);
const doubled = map(counter, n => n * 2);
const even = filter(doubled, n => n % 2 === 0);

even.stream.subscribe(value => console.log(value));
counter.set(1); // filtered out
counter.set(2); // logs 4
```

## Effect Namespace

Side-effect oriented utilities are grouped under `dagify/effect`:

```js
import { effect } from "dagify/effect";

const cmd = effect.command("@user/update", payload => payload);
const bridgeNode = effect.bridge(inputNode, outputNode);
const sinkNode = effect.sink(value => console.log(value));
const eventNode = effect.fromEvent("socket/data");
```

The namespace also re-exports `trigger`, `createTrigger`, and the shared `dispatcher`.

## Behavior Changes

- `ReactiveNode` now exposes a `.stream` getter (alias of `toObservable()`).
- `fromObservable` accepts an optional config object that is passed to the underlying `ReactiveNode`.
- FRP helpers default to `NO_EMIT` until a source emits—be mindful when asserting initial values in tests.

## Checklist

1. Update imports to use the scoped modules.
2. Replace manual observable plumbing with the new FRP helpers where it simplifies code.
3. If you consumed effect utilities from the root entry, migrate them to `dagify/effect`.
4. Run the updated test suite to confirm behavior (`npm test`).

For any issues, please open a GitHub issue with reproduction steps. Happy migrating!

