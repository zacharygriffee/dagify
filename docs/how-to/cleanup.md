# Cleanup & Lifecycle Strategy

Prevent leaks, wedged timers, and stale edges when tearing down Dagify graphs.

## When to clean up
- Module teardown (routing/page change, worker shutdown, tab close).
- Tests that spin up graphs/effects.
- Swapping external handles (network/storage SDKs) into reference nodes.

## Nodes and subscriptions
- Call `complete()` on nodes that:
  - Start timers (activity-thresholding decay).
  - Subscribe to external streams (e.g., `fromEvent`, `from` on observables).
  - Own resources (file handles, sockets).
- Unsubscribe manual `stream.subscribe(...)` listeners you created (keep disposables in a scope).

## Graph hygiene
- `disconnect(from, to)` before removal when edges may linger.
- `removeNode(node)` to drop nodes and their edges; keeps topological queries accurate.
- Use `createsCycle` when dynamically wiring edges to avoid invalid graphs that are hard to tear down.

## Effects
- Command/bridge/sink nodes tied to external side effects should be `complete()`-ed when their domain ends, especially if handlers hold onto clients.
- `fromEvent` nodes rely on the shared dispatcher; `complete()` detaches their listener.
- If you wrap EventEmitter/DOM sources manually, ensure you remove listeners on teardown.

## Activity thresholding
- Nodes with `enableActivityThresholding` start internal decay timers. Always `complete()` them to clear the interval when the node is no longer needed.

## Queued/async work
- `createQueuedNode` will keep draining queued payloads. On shutdown, `complete()` to stop accepting/enqueuing and let callers know to halt.
- Commands with `disableBatching: false` may coalesce; ensure upstream callers know whether pending work should flush or discard on teardown.
- If you keep a per-module queue, expose a `flush()` or `drop()` helper and document which you intend to call on shutdown.

## Reference nodes (imperative handles)
- When swapping SDK clients/sockets/storage handles in `createReferenceNode`, optionally call custom `close()`/`destroy()` on the old handle before `set(newHandle)`.
- After swapping, consider `complete()` on the outbound node if no further emissions are expected.

## Disposable resource patterns
Use these patterns when nodes create handles that must be torn down before replacing them.

### Singleton handle per dependency
```js
const makeHandle = depNode => {
  let current = null;
  return createNode(async dep => {
    if (current) await current.dispose?.();
    current = new DisposableThing(dep);
    return current; // emits the new handle
  }, depNode);
};
```
- Always dispose the previous handle before creating the next.
- Return the handle (often via `createReferenceNode`) so downstream consumers see identity changes, not internal state churn.

### Pool of disposables
```js
const makePool = depNode => {
  const handles = new Map();
  return createNode(async dep => {
    const id = dep.id;
    if (handles.has(id)) await handles.get(id).dispose?.();
    const next = new DisposableThing(dep);
    handles.set(id, next);
    return handles;
  }, depNode);
};
```
- Track disposables in a `Set`/`Map` keyed by id. Dispose before replacing.
- Expose a `cleanupAll()` helper to iterate and dispose everything on teardown; call it from the module’s `dispose()` or `complete()`.

## Testing & dev ergonomics
- Provide a `dispose()` helper per module that:
  - cancels timers
  - completes nodes/effects
  - removes graph nodes/edges
  - unsubscribes external listeners
- Use `once()` or temporary subscriptions for probes instead of long-lived listeners.
