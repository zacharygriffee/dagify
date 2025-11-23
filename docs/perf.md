# Dagify performance harness (perf/core-opts branch)

Use the built-in benches to profile hot paths and compare variants:

```bash
npm run bench
```

Current scenarios (see `bench/perf.js`):
- `fan-out 1 -> 300 (5 updates)`: batched dependents (default scheduler).
- `fan-out 1 -> 300 unbatched`: dependents with `disableBatching: true`.
- `fan-out 1 -> 300 sync schedulers`: update/notify forced synchronous.
- `fan-out 1 -> 1000 (5 updates)`: large fan-out sizing.
- `fan-in 300 -> 1`: single computed over 300 sources with subset updates.
- `fan-in 1000 -> 1`: larger fan-in sizing.
- `notify 1000 subscribers`: fan-out over 1k subscribers (batched).
- `notify 1000 subscribers (unbatched)`: synchronous subscriber delivery.
- `notify 1000 subscribers (sync scheduler)`: explicit sync notify.
- `queued node serial async`: 100 enqueues, with 0ms or 1ms async work.

Example numbers on this branch (local Node run, ms = latency per task):

| scenario | hz | avg | notes |
| --- | --- | --- | --- |
| fan-out 1 -> 300 (batched) | ~524 | ~2.4 ms | batched microtask delivery |
| fan-out 1 -> 300 (unbatched) | ~365 | ~2.9 ms | synchronous notify (no microtasks) |
| fan-out 1 -> 300 (sync schedulers) | ~296 | ~3.8 ms | sync update + notify |
| fan-out 1 -> 1000 | ~150 | ~7.2 ms | large fan-out |
| fan-in 300 -> 1 | ~495 | ~2.4 ms | reduce over 300 inputs |
| fan-in 1000 -> 1 | ~194 | ~5.8 ms | larger reduce |
| notify 1000 subs (batched) | ~771 | ~1.4 ms | per-subscriber microtasks |
| notify 1000 subs (unbatched) | ~5282 | ~0.22 ms | sync fan-out, no microtasks |
| notify 1000 subs (sync scheduler) | ~5544 | ~0.20 ms | explicit sync notify |
| queued 100 enqueues, 0ms work | ~48 | ~20.8 ms | serialization overhead only |
| queued 100 enqueues, 1ms work | ~5 | ~200.9 ms | dominated by async payloads |

## Scheduler tuning

You can swap schedulers to trade latency vs. safety:
- Built-ins: `microtask` (default), `messageChannel`, `timeout`, `immediate`, `sync` (`lib/util/schedulers.js` via `dagify/internal/schedulers`).
- Per-node overrides: `createNode(value, deps, { updateScheduler, notifyScheduler })`.
- Global override: `setSchedulers({ updateScheduler, notifyScheduler })`.

Notes:
- `sync` notify/update is fastest but fully reentrant (subscribers run immediately; errors surface synchronously).
- `microtask` batches notifications and avoids reentrancy but adds microtask overhead.
- Try `sync` on hot fan-out paths where you control subscriber side effects; keep default elsewhere.

Reading the numbers:
- Batched delivery protects against reentrancy but adds microtask overhead; unbatched can be 5–10x faster for hot fan-out paths if the caller can tolerate synchronous delivery.
- Queue serialization is linear in work; throughput ~50 ops/s with zero async work and ~5 ops/s with 1ms async payloads.
- Fan-in is dominated by compute work (reduce over 300), so trimming dependency traversal/cloning would show up here.

To add more cases, edit `bench/perf.js` and re-run `npm run bench`. For reproducible comparisons, capture outputs before/after changes and keep hardware/Node version constant.
