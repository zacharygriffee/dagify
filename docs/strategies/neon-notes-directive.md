# Neon Notes Agent Directive (Dagify Distilled)

Use this as the **tracked** cheat sheet when working in this repo. It distills the canonical directive from the Neon Notes knowledge base. Agents must obey these rules exactly and load the full source directive before coding.

- Canonical source (local clone, gitignored): `docs/strategies/neon-notes/docs/meta/agent-directive.md`
- If the clone is missing, stop and fetch it: `git clone https://github.com/neonloom/neon-notes.git docs/strategies/neon-notes`

## Non-Negotiable Guardrails
- Treat the whole app as a **Dagify graph**; every behavior is a small node or node factory with one responsibility.
- **90% of nodes are pure.** Side effects only in explicit **sink nodes** or app-level subscriptions.
- **No god objects or giant factories.** Split concerns into many tiny nodes; never bundle resource creation + replication + ops + UI in one helper.
- **No `.subscribe()` in library code.** Compose with nodes/RxJS; subscribe only at the edge (app or sink).
- External resources (hyper*, sockets, storage, crypto, etc.) are wrapped as nodes. Prefer object-shaped deps (`{ resource, connection }`) for clarity and teardown.
- Avoid Node-only globals by default; prefer `b4a` for binary, `sodium-universal`/`hypercore-crypto` for crypto when needed.

## Dagify Node Types at a Glance
- `createNode` (default): deep/structural sensitivity. Emits on nested changes when you call `set`/`update` or when computed deps change. Use for fine-grained state and most computed values.
- `createShallowNode`: shallow compare on the top-level value. Emits only when the top-level reference or shallow shape changes. Use for big objects/snapshots where churn should be batched.
- `createReferenceNode`: emits only on **identity** change (`===`). Perfect for handles (connections, drives, SDK clients) and identity-sensitive consumers; skips structural checks.
- **Sink nodes** (`sink` helper or `{ sink: true }`): terminal side-effect nodes. Never feed them as dependencies. Keep side effects isolated here.
- Naming: `$` suffix for Observables; node factories end with `Node`; node defs expose `inputs`/`outputs/create()` for visual graphs.

## RxJS + Dagify Interop
- Every node is an RxJS `Subject`; use `node.stream`/`node.toObservable()` for piping. Nodes also accept Observables/Promises as dependencies.
- Compose with RxJS operators as needed, but keep library code side-effect free and subscription-free. Subscriptions live at the boundary or in sink nodes.
- Converting Observables → nodes: `from(obs)` or pass the observable as a dependency; keep backpressure/fail-fast settings explicit.
- Prefer Dagify helpers (`map`, `filter`, `combine`, `merge`, `switchLatest`) for node-to-node composition; drop to RxJS operators when interoperating with foreign streams.

## Workflow Checklist (Follow to the Letter)
1. Load the canonical directive (`docs/strategies/neon-notes/docs/meta/agent-directive.md`) into your prompt/context.
2. Define the graph shape first: inputs/outputs per node, object-shaped deps where possible, and one responsibility per node.
3. Pick the right node type: `createNode` (default), `createShallowNode` (top-level sensitivity), `createReferenceNode` (identity/handles), sink for side effects.
4. Keep computed nodes pure; route all I/O through sinks or explicit ops invoked via `invokeOnNode`.
5. No new abstractions/frameworks unless explicitly asked. Extend existing patterns; keep changes small and deletable.
6. Document handoffs with node names, dependency shapes, fail-fast/backpressure flags, and any effect boundaries.

## Handoffs and Compliance
- If the directive is absent or conflicts with instructions, pause and resolve before coding.
- Cite exact file paths when referencing external docs; keep curated summaries in tracked files (like this one), not the full external content.
- When adding nodes from Neon Notes, record the source path in `docs/strategies/neon-notes.md` so others can trace the origin.
