# Dagify Documentation

Use this index as the single source of truth for Dagify. It is organized for both humans and LLM agents; each section links to focused guides and reference pages.

- **Getting Started**
  - [Quickstart](getting-started/quickstart.md): install, create your first nodes, and see how FRP helpers fit in.
- **Concepts**
  - [Dependency shapes](concepts/dependency-shapes.md): array vs object inputs and when to use each.
  - [Nodes vs piped nodes](concepts/node-vs-piped-node.md): architectural trade-offs.
  - [NO_EMIT](concepts/no-emit.md), [Unbatched nodes](concepts/unbatched.md), [Shallow vs deep](concepts/shallow-vs-deep.md), [Types vs encodings](concepts/types-vs-encodings.md).
- **How-To Guides**
  - [Graph lifecycle](how-to/graph-ops.md): connect, update, and inspect graphs safely.
  - [Cleanup & lifecycle](how-to/cleanup.md): avoid leaks and tear down graphs/nodes cleanly.
  - [RxJS & Svelte interop](how-to/rxjs-and-svelte.md): using Dagify as a drop-in store and pipe target.
  - [Diff operator](how-to/diff-operator.md) and [activity thresholding](how-to/activity-thresholding.md) patterns.
  - [Side-effects](how-to/side-effects.md): commands, bridges, sinks, and triggers in practice.
- **Reference**
  - FRP: [FRP helpers](reference/frp-helpers.md).
  - Graph/data: [Composite nodes](reference/composite.md), [Reference nodes](reference/reference-node.md).
  - Execution: [Execution & queued nodes](reference/execution-nodes.md).
  - Effects: [Effect namespace](reference/effect.md).
  - Node types: [Command](reference/command-node.md), [Bridge](reference/bridge-node.md), [Filter](reference/filter-node.md), [Sink](reference/sink-node.md), [Trigger](reference/trigger-node.md), [Event trigger](reference/event-trigger-node.md).
  - Internals & utilities: [Encodings](reference/encodings.md), [Types](reference/types.md), [Key generators](reference/key-generator.md).
- **Guides**
  - [Migration 2.0](guides/migration-2.0.md), [Dagify vs RxJS](guides/dagify-vs-rxjs.md).
- **Best Practices & Ops**
  - [Best practices](best-practices.md): modeling state/events, effects boundaries, fail-fast, backpressure.
  - [Observability & debugging](observability-and-debugging.md): graph introspection and tracing workflows.
- **Examples**
  - [Recipes](examples/recipes.md) plus runnable samples in `examples/`.
- **Agents**
  - [Agent primer](agents/primer.md) for LLM/human handoffs and the repository prompt references.

If you are looking for a specific export, start with the reference pages or the Quickstart, which links out to deeper sections as you go.
