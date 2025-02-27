import { test, solo } from "brittle";
import { createNode } from "../../lib/node/index.js";
import { sleep } from "../helpers/sleep.js";
import {createSinkNode} from "../../lib/sink-node/index.js";

// --------------------------------------------------------------------------
// Sink Node Tests
// --------------------------------------------------------------------------

test("sink node behaves just like a regular node except it cannot be a dependency.", async t => {
    // Create a sink node that, when triggered, pushes the received value into an array.
    const dep = createNode(42);
    const sink = createSinkNode(x => x, dep);

    // Trigger the sink node by calling next() with a value.
    sink.next(42);
    await sleep();
    t.alike(sink.value, 42, "Side effect executed with value 42");
});

test("sink node does not propagate emissions to subscribers", async t => {
    let callCount = 0;
    // Create a sink node with a side effect.
    const sink = createSinkNode(val => {
        // Side effect executes, but we do not expect a normal emission.
    });

    // If someone subscribes to a sink node, it should be considered an error.
    t.exception(() => {
        sink.subscribe(() => callCount++);
    }, "Subscribing to a sink node is not allowed as it is terminal");

    await sleep(50);
    t.is(callCount, 0, "No emission propagated to subscribers");
});

test("sink node cannot be used as a dependency for computed nodes", t => {
    // Create a sink node.
    const sink = createSinkNode(val => {
        /* side effect */
    });

    // Attempting to use a sink node as a dependency should throw an error.
    t.exception(() => {
        createNode(([val]) => val, [sink]);
    }, "Using sink node as a dependency throws an error");
});
