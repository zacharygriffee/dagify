# Best Practices

Opinionated guidance for building robust Dagify graphs across human and LLM contributors.

## Model state vs. events explicitly
- Use `createNode`/`createStore` for state and `effect.command`/`effect.trigger` for events; avoid mixing both semantics in one node.
- Prefer object-shaped dependencies when grouping related state (`{ price, threshold }`) and arrays when order matters (`[source$, sink$]`).

## Keep effects at the edges
- Boundaries: commands, bridges, sinks, and triggers live at the edge; computed nodes stay pure.
- For async or lossy work, wrap handlers with `createQueuedNode` (or `disableBatching: false` on commands) and surface overflow hooks to callers.

## Fail fast by default
- Keep `setFailFastEnabled(true)` in dev; override per-node with `{ failFast: false }` only for long-running I/O nodes.
- Use `failFastPredicate` to treat transient network/storage errors as non-fatal while still crashing on programming errors.

## Manage references deliberately
- Use shallow nodes when you model large objects that change wholesale; otherwise prefer deep comparison to suppress noisy emits.
- Always emit new references when mutating nested data—reuse suppresses emissions and can hide bugs.

## Control backpressure and batching
- Wrap bursty updates in `batch()` to avoid recomputation storms.
- Use `createQueuedNode` or command batching when side-effect ordering matters; configure `maxQueueLength`, `overflowStrategy`, and `onOverflow` to prevent unbounded queues.

## Lifecycle and cleanup
- Call `complete()` on nodes that set timers (activity-thresholding) or subscribe to external streams to prevent leaks.
- When building graphs, remove nodes and disconnect edges when tearing down modules to keep topological queries accurate.

## Naming, keys, and ownership
- Name nodes with domain language (`user:email`, `checkout:payment`) and document ownership in the surrounding module README.
- If you rely on custom key generators, keep them isolated per graph to avoid collisions across dynamic factories.

## Testing & verification
- Exercise commands/bridges with a minimal harness: emit payloads, assert ordered output, and cover overflow/error cases.
- Keep runnable samples in `examples/` up to date; prefer short, verified snippets in docs and link to the full code when longer.
