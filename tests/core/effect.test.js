import test from "brittle";
import { createNode } from "../../lib/node/index.js";
import {
    command,
    bridge,
    sink,
    fromEvent,
    trigger,
    createTrigger,
    dispatcher
} from "../../lib/effect/index.js";
import { sleep } from "../helpers/sleep.js";

test("command effect processes payloads", async t => {
    const cmd = command("@effect/test", data => data * 2);
    let result;
    cmd.subscribe(value => result = value);
    await cmd.set(3);
    await sleep(10);
    t.is(result, 6, "command handler runs and emits result");
});

test("bridge effect forwards values through output node", async t => {
    const source = createNode(2);
    const output = createNode(([value]) => value * 3, [source]);
    const bridgeNode = bridge(source, output);
    t.is(bridgeNode.value, 6, "bridge exposes output value");
    await bridgeNode.set(4);
    await sleep(10);
    t.is(bridgeNode.value, 12, "bridge recomputes when input changes");
});

test("sink effect marks node as terminal", t => {
    const sinkNode = sink(value => value, []);
    t.ok(sinkNode.isSink, "sink effect creates terminal node");
});

test("fromEvent effect listens on dispatcher", async t => {
    const eventNode = fromEvent("test:event", 0);
    let observed;
    eventNode.subscribe(value => observed = value);
    dispatcher.emit("test:event", 42);
    await sleep(10);
    t.is(observed, 42, "event node receives dispatcher payload");
});

test("trigger effect integrates with manual trigger", async t => {
    const manual = createTrigger();
    const count = trigger(manual);
    let latest;
    count.subscribe(value => latest = value);
    manual.next();
    manual.next();
    await sleep(10);
    t.is(latest, 2, "trigger increments with manual emissions");
});
