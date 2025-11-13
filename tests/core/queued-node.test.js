import { test } from "brittle";
import { createNode, createQueuedNode, NO_EMIT } from "../../index.js";
import { Observable } from "rxjs";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

test("queued node serializes async promise work", async (t) => {
    const upstream = createNode(0);
    const observed = [];

    const queued = createQueuedNode(async (value) => {
        const wait = value === 40 ? 50 : value === 30 ? 10 : 0;
        await delay(wait);
        return value;
    }, upstream);

    let skipInitial = true;
    queued.subscribe((value) => {
        if (skipInitial) {
            skipInitial = false;
            return;
        }
        observed.push(value);
    });

    upstream.set(40);
    upstream.set(30);
    upstream.set(10);

    await delay(120);
    t.alike(observed, [40, 30, 10], "values resolve in the order they were queued");
});

test("queued node waits for first non-NO_EMIT observable value", async (t) => {
    const upstream = createNode(0);
    const emitted = [];

    const queued = createQueuedNode((value) => new Observable((observer) => {
        observer.next(NO_EMIT);
        const timer = setTimeout(() => {
            observer.next(value * 2);
            observer.complete();
        }, value === 5 ? 40 : 5);
        return () => clearTimeout(timer);
    }), upstream);

    let skipSeed = true;
    queued.subscribe((value) => {
        if (skipSeed) {
            skipSeed = false;
            return;
        }
        emitted.push(value);
    });

    upstream.set(5);
    upstream.set(2);

    await delay(100);
    t.alike(emitted, [10, 4], "observable results stay ordered and skip NO_EMIT");
});

test("queued node drops newest payloads when queue is full", async (t) => {
    const upstream = createNode(0);
    const observed = [];
    const queued = createQueuedNode(async (value) => {
        await delay(30);
        return value;
    }, upstream, { maxQueueLength: 2, overflowStrategy: "drop-newest" });

    let skip = true;
    queued.subscribe((value) => {
        if (skip) {
            skip = false;
            return;
        }
        observed.push(value);
    });

    await delay(20);
    upstream.set(1);
    upstream.set(2);
    upstream.set(3);
    upstream.set(4);

    await delay(200);
    t.alike(observed, [1, 2], "drop-newest keeps earliest queued payloads");
});

test("queued node can drop oldest payloads to make room", async (t) => {
    const upstream = createNode(0);
    const observed = [];
    const queued = createQueuedNode(async (value) => {
        await delay(30);
        return value;
    }, upstream, { maxQueueLength: 2, overflowStrategy: "drop-oldest" });

    let skip = true;
    queued.subscribe((value) => {
        if (skip) {
            skip = false;
            return;
        }
        observed.push(value);
    });

    await delay(20);
    upstream.set(1);
    upstream.set(2);
    upstream.set(3);
    upstream.set(4);

    await delay(200);
    t.alike(observed, [3, 4], "drop-oldest keeps the most recent payloads");
});

test("queued node onOverflow can override strategy", async (t) => {
    const upstream = createNode(0);
    const calls = [];
    const queued = createQueuedNode(async (value) => {
        await delay(10);
        return value;
    }, upstream, {
        maxQueueLength: 1,
        overflowStrategy: "drop-newest",
        onOverflow: (info) => {
            calls.push(info);
            return "enqueue";
        }
    });

    let skip = true;
    const seen = [];
    queued.subscribe((value) => {
        if (skip) {
            skip = false;
            return;
        }
        seen.push(value);
    });

    await delay(20);
    upstream.set(1);
    upstream.set(2);
    upstream.set(3);

    await delay(120);
    t.alike(seen, [1, 2, 3], "override 'enqueue' allows all payloads through");
    t.is(calls.length > 0, true, "onOverflow should be invoked when queue is full");
});
