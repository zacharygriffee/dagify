# FRP Helpers (`dagify/frp`)

Functional operators that accept Dagify nodes or RxJS observables and return Dagify nodes with a `.stream` facade.

```js
import {
  map,
  filter,
  combine,
  merge,
  switchLatest,
  from,
  createStore,
  invokeOnNode,
} from "dagify/frp";
```

- `map(source, projector, options?)`: project values; `options.triggerOnNoEmit` to include initial `NO_EMIT`.
- `filter(source, predicate, options?)`: drop values that fail the predicate.
- `combine(sources, projector?, options?)`: accept an array or object of sources; projector gets positional args (array) or values (object).
- `merge(sources, options?)`: fan-in multiple sources, emitting as they arrive.
- `switchLatest(source, projector?, options?)`: swap to the latest inner stream/node (like RxJS `switchMap`).
- `from(input, options?)`: wrap a node, observable, promise, or value as a Dagify node.
- `createStore(initial, config?)`: stateful node alias with good defaults for FRP flows.
- `invokeOnNode(source, methodName, ...args)`: call a method on a node/observable and emit the result (or `NO_EMIT`).

## Options

All operators accept `{ initialValue?, config?, nodeConfig?, triggerOnNoEmit? }`:
- `initialValue`: seed value before any emission.
- `config` / `nodeConfig`: forwarded to the underlying node creation.
- `triggerOnNoEmit`: if `true`, projectors receive `NO_EMIT` emissions; defaults to skipping them.
