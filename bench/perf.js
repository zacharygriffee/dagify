import { Bench } from "tinybench";
import { createNode, createQueuedNode } from "../index.js";
import { schedulerPresets } from "../lib/util/schedulers.js";

const sleep = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

const bench = new Bench({
    time: 250,
    iterations: 10,
    warmup: false,
    warmupTime: 0,
    warmupIterations: 0
});

bench.add("fan-out 1 -> 300 (5 updates)", async () => {
    const source = createNode(0);
    const dependents = [];
    for (let i = 0; i < 300; i++) {
        dependents.push(createNode(([v]) => v + 1, [source]));
    }
    for (let i = 1; i <= 5; i++) {
        source.set(i);
    }
    await sleep(0); // flush microtasks
    dependents.forEach(node => node.complete());
    source.complete();
});

bench.add("fan-out 1 -> 300 unbatched (5 updates)", async () => {
    const source = createNode(0);
    const dependents = [];
    for (let i = 0; i < 300; i++) {
        dependents.push(createNode(([v]) => v + 1, [source], { disableBatching: true }));
    }
    for (let i = 1; i <= 5; i++) {
        source.set(i);
    }
    dependents.forEach(node => node.complete());
    source.complete();
});

bench.add("fan-out 1 -> 300 sync schedulers (5 updates)", async () => {
    const source = createNode(0, undefined, {
        updateScheduler: schedulerPresets.sync,
        notifyScheduler: schedulerPresets.sync
    });
    const dependents = [];
    for (let i = 0; i < 300; i++) {
        dependents.push(createNode(
            ([v]) => v + 1,
            [source],
            { updateScheduler: schedulerPresets.sync, notifyScheduler: schedulerPresets.sync }
        ));
    }
    for (let i = 1; i <= 5; i++) {
        source.set(i);
    }
    dependents.forEach(node => node.complete());
    source.complete();
});

bench.add("fan-out 1 -> 1000 (5 updates)", async () => {
    const source = createNode(0);
    const dependents = [];
    for (let i = 0; i < 1000; i++) {
        dependents.push(createNode(([v]) => v + 1, [source]));
    }
    for (let i = 1; i <= 5; i++) {
        source.set(i);
    }
    await sleep(0);
    dependents.forEach(node => node.complete());
    source.complete();
});

bench.add("fan-in 300 -> 1 (subset updates)", async () => {
    const sources = Array.from({ length: 300 }, (_, i) => createNode(i));
    const combined = createNode((vals) => vals.reduce((acc, v) => acc + v, 0), sources);
    for (let i = 0; i < sources.length; i += 5) {
        sources[i].set(i * 2);
    }
    await sleep(0);
    combined.complete();
    sources.forEach(node => node.complete());
});

bench.add("fan-in 1000 -> 1 (subset updates)", async () => {
    const sources = Array.from({ length: 1000 }, (_, i) => createNode(i));
    const combined = createNode((vals) => vals.reduce((acc, v) => acc + v, 0), sources);
    for (let i = 0; i < sources.length; i += 10) {
        sources[i].set(i * 2);
    }
    await sleep(0);
    combined.complete();
    sources.forEach(node => node.complete());
});

bench.add("notify 1000 subscribers", async () => {
    const node = createNode(0);
    const unsubs = [];
    for (let i = 0; i < 1000; i++) {
        unsubs.push(node.subscribe(() => {}));
    }
    node.set(1);
    await sleep(0);
    unsubs.forEach(unsub => unsub());
    node.complete();
});

bench.add("notify 1000 subscribers (unbatched)", async () => {
    const node = createNode(0, undefined, { disableBatching: true });
    const unsubs = [];
    for (let i = 0; i < 1000; i++) {
        unsubs.push(node.subscribe(() => {}));
    }
    node.set(1);
    unsubs.forEach(unsub => unsub());
    node.complete();
});

bench.add("notify 1000 subscribers (sync scheduler)", async () => {
    const node = createNode(0, undefined, { notifyScheduler: schedulerPresets.sync });
    const unsubs = [];
    for (let i = 0; i < 1000; i++) {
        unsubs.push(node.subscribe(() => {}));
    }
    node.set(1);
    unsubs.forEach(unsub => unsub());
    node.complete();
});

bench.add("queued node serial async (100 enqueues, 0ms work)", async () => {
    const upstream = createNode(0);
    const queued = createQueuedNode(async (v) => v + 1, upstream, { maxQueueLength: 1000 });
    for (let i = 1; i <= 100; i++) {
        upstream.set(i);
    }
    await sleep(20); // allow queue to drain
    queued.complete();
    upstream.complete();
});

bench.add("queued node serial async (100 enqueues, 1ms work)", async () => {
    const upstream = createNode(0);
    const queued = createQueuedNode(async (v) => {
        await sleep(1);
        return v + 1;
    }, upstream, { maxQueueLength: 1000 });
    for (let i = 1; i <= 100; i++) {
        upstream.set(i);
    }
    await sleep(200); // allow queue to drain
    queued.complete();
    upstream.complete();
});

const main = async () => {
    await bench.run();
    const results = bench.tasks.map(task => {
        const { result } = task;
        const mean = typeof result?.mean === "number" ? result.mean : null; // ms
        const sd = typeof result?.sd === "number" ? result.sd : null; // ms
        const hz = typeof result?.hz === "number" ? result.hz : null;
        return {
            name: task.name,
            hz: hz !== null ? hz.toFixed(2) : "n/a",
            ops: result?.runs ?? "n/a",
            avg: mean !== null ? `${mean.toFixed(3)} ms` : "n/a",
            sd: sd !== null ? `${sd.toFixed(3)} ms` : "n/a",
            error: task.error ? String(task.error) : ""
        };
    });
    console.table(results);
};

main().catch(err => {
    console.error(err);
    process.exit(1);
});
