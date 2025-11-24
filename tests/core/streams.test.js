import { test } from "brittle";
import { fromAsyncIterable, toAsyncIterable, toReadableStream } from "../../lib/streams/index.js";
import { createNode } from "../../lib/node/index.js";
import { sleep } from "../helpers/sleep.js";

test("fromAsyncIterable emits all values", async t => {
    async function* gen() {
        yield "a";
        yield "b";
        yield "c";
    }
    const node = fromAsyncIterable(gen());

    const received = [];
    node.subscribe(value => received.push(value));

    await sleep(10);
    t.alike(received, ["a", "b", "c"], "all iterable values were emitted");
});

test("toAsyncIterable errors on overflow by default", async t => {
    t.plan(2);
    const node = createNode(undefined, { disableBatching: true });
    const asyncIter = toAsyncIterable(node, { maxBuffer: 1 })[Symbol.asyncIterator]();

    node.set(1);
    node.set(2); // triggers overflow

    const first = await asyncIter.next();
    t.is(first.value, 1, "first value is delivered");
    await t.exception(async () => asyncIter.next(), /overflow/i);
});

test("toReadableStream converts nodes to Node streams", async t => {
    const node = createNode();
    const readable = await toReadableStream(node, { maxBuffer: 4 });

    node.set("x");
    node.set("y");
    node.complete();

    const received = [];
    for await (const chunk of readable) {
        received.push(chunk);
    }
    t.alike(received, ["x", "y"], "readable stream delivers node values");
});
