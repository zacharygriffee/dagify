# Observability & Debugging

Ways to understand what your graph is doing and to surface problems early.

## Inspect the graph
- `graph.topologicalSort()` → execution order; map keys to ids with `graph.getNode(key).id`.
- `getImmediatePredecessors(node)` / `getSuccessors(node)` → local neighborhood; `getSources()` / `getSinks()` → endpoints.
- `createsCycle(from, to)` → guard edge additions; `findPath(a, b)` → explain why dependencies flow a certain way.

## Trace emissions
- Subscribe with lightweight loggers in dev: `node.stream.subscribe(v => console.debug(node.id, v))`.
- Use `once()` for one-off probes and `skip(n)` to ignore initial warm-up emissions.
- For FRP helpers, attach to returned nodes so you can see combined/merged behavior without altering sources.

## Errors and fail-fast
- Development: leave fail-fast enabled to crash on programming errors; production: override per-node to keep long-lived I/O alive.
- Capture `dependencyError$` if you need to surface non-fatal issues to monitoring without crashing.

## Reproduce and minimize
- Wrap batchy flows in `batch()` during repro to keep signal-to-noise high.
- Replace real handlers in bridges/commands with spies to confirm payload shapes and ordering before hitting external systems.

## Cleanup and leaks
- Nodes with timers (activity-thresholding) or external subscriptions need `complete()` when scopes end.
- In modular systems, `disconnect` and `removeNode` before disposing the graph to prevent dangling references in introspection.

## Quick checklist
- Are you seeing missing emissions? Check shallow nodes for reused references and unqueued async work.
- Are you seeing too many emissions? Add batching, confirm dependency shapes (object vs array), and ensure `NO_EMIT` isn’t being treated as real data.
