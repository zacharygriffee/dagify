# Neon Notes Strategy

Neon Notes is an external knowledge base for the broader ecosystem this project participates in. Use it to guide agent behavior and to catalog reusable nodes once the content is available locally.

## Local Sync (gitignored)

Clone the repo into the ignored folder so you can browse all docs without polluting Dagify commits:

```bash
mkdir -p docs/strategies
git clone https://github.com/neonloom/neon-notes.git docs/strategies/neon-notes
# later: git -C docs/strategies/neon-notes pull
```

The clone lives at `docs/strategies/neon-notes/` and is ignored by git (see `.gitignore`).

## How to Use It

- Keep curated pointers or distilled notes in tracked docs (this file and siblings); avoid copying the entire repo into version control.
- When cataloging nodes from Neon Notes, record a short summary plus the source path inside that repo so others can find the original context.
- For agent directives, translate them into Dagify-friendly handoff templates (graph shape, dependency shape, effect boundaries, fail-fast/backpressure flags) and link back to the originating doc.

## TODO once content is pulled

- Inventory reusable nodes from the Neon Notes repo and list them with links back to their source files.
- Add an agent directive template that reflects the Neon Notes guidance so LLMs can follow it when authoring nodes.
