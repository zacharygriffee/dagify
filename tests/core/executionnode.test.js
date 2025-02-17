import { test, solo } from "brittle";
import { Subject } from "../../lib/rxjs/rxjsPrebuilt.js";
import { ExecutionNode } from "../../lib/node/ExecutionNode.js";
import { createNode } from "../../index.js";
import { sleep } from "../helpers/sleep.js";

// ===== ExecutionNode Stateful Tests =====

test("ExecutionNode (stateful) should initialize with a value", (t) => {
    const node = new ExecutionNode(42);
    t.is(node.value, 42, "ExecutionNode stateful should initialize with the given value");
});

test("ExecutionNode (stateful) should not emit on subscription and only re-emit on trigger", async (t) => {
    t.plan(3);
    const node = new ExecutionNode(100);
    let emissions = [];
    node.subscribe((val) => emissions.push(val));

    // Since no automatic emission is expected, there should be no emissions initially.
    await sleep(20);
    t.is(emissions.length, 0, "No emission occurs on subscription");

    // Trigger execution: should emit the current value.
    node.triggerExecution();
    await sleep(20);
    t.is(emissions.length, 1, "Trigger emits one value");
    t.is(emissions[0], 100, "Emitted value equals the current value");
});

// ===== ExecutionNode Computed Tests =====

test("ExecutionNode (computed) should compute only on trigger", async (t) => {
    t.plan(3);
    // Create dependencies
    const a = createNode(2);
    const b = createNode(3);
    // Computed function: sum of a and b.
    const sumComputed = new ExecutionNode(
        ([a, b]) => a + b,
        [a, b]
    );

    // The node's internal value is computed on creation:
    t.is(sumComputed.value, 5, "Initial computed value is 5");

    let emissions = [];
    sumComputed.subscribe((val) => {
        emissions.push(val);
    });

    // No emission should occur on subscription.
    await sleep(20);
    t.is(emissions.length, 0, "No emission occurs on subscription for computed node");

    // Change dependency—this should NOT auto-trigger a recomputation.
    a.set(7);
    await sleep(20);
    t.is(sumComputed.value, 5, "Computed value remains unchanged without trigger");
});

test("ExecutionNode (computed) should emit only when triggered", async (t) => {
    t.plan(3);
    // Create dependencies
    const a = createNode(2);
    const b = createNode(3);
    const sumComputed = new ExecutionNode(
        ([a, b]) => a + b,
        [a, b]
    );

    let emissions = [];
    sumComputed.subscribe((val) => {
        emissions.push(val);
    });

    // Trigger execution: since a is still 2 and b is 3, computed value is 5.
    sumComputed.triggerExecution();
    await sleep(20);
    t.is(emissions[0], 5, "First trigger emits 5");

    // Update dependency.
    a.set(7); // Now computed would be 7+3=10 if triggered.
    // Without trigger, the internal value remains unchanged.
    await sleep(20);
    t.is(sumComputed.value, 5, "Computed value remains 5 without trigger");

    // Trigger execution again.
    sumComputed.triggerExecution();
    await sleep(20);
    t.is(sumComputed.value, 10, "After trigger, computed value updates to 10");
});

test("ExecutionNode (computed) should work with an external execution stream", async (t) => {
    t.plan(3);
    // Create an external execution stream.
    const execStream = new Subject();
    const a = createNode(5);
    // Computed node that doubles a.
    const doubleNode = new ExecutionNode(
        ([a]) => a * 2,
        [a],
        execStream
    );

    t.is(doubleNode.value, 10, "Initial computed value is 10");

    let emissions = [];
    doubleNode.subscribe((val) => emissions.push(val));

    // Change dependency; no automatic update.
    a.set(8);
    await sleep(20);
    t.is(doubleNode.value, 10, "Without triggering, value remains unchanged");

    // Trigger externally via the provided execution stream.
    execStream.next();
    await sleep(20);
    // Now doubleNode should recompute: 8 * 2 = 16.
    t.is(doubleNode.value, 16, "Computed node updates after external stream trigger");
});

test("ExecutionNode (computed) multiple triggers produce multiple emissions", async (t) => {
    t.plan(2);
    const dep = createNode(10);
    const computed = new ExecutionNode(
        ([val]) => val + 5,
        [dep]
    );

    const values = [];
    computed.subscribe((v) => values.push(v));

    // Trigger a couple of times manually.
    computed.triggerExecution();  // Should compute using dep.value (10) and emit 15.
    await sleep(20);
    dep.set(20); // change dependency; no auto update
    computed.triggerExecution();  // Now computes 20 + 5 = 25.
    await sleep(20);

    t.is(values[0], 15, "First trigger emits 15");
    t.is(values[1], 25, "Second trigger emits 25");
});

test("ExecutionNode (computed) should ignore automatic dependency updates", async (t) => {
    t.plan(2);
    const a = createNode(3);
    const computed = new ExecutionNode(
        ([a]) => a * 3,
        [a]
    );

    t.is(computed.value, 9, "Initial computed value is 9");

    let triggered = false;
    computed.subscribe(() => {
        triggered = true;
    });

    // Change dependency, but do not trigger.
    a.set(4);
    await sleep(50);
    t.absent(triggered, "No emission occurs when dependency changes without trigger");
});

test("ExecutionNode should not emit after disposal of execution subscription", async (t) => {
    t.plan(2);
    // For stateful nodes, we want no emission after a subscriber unsubscribes.
    const node = new ExecutionNode(50);
    let emissions = [];
    const sub = node.subscribe((val) => emissions.push(val));

    // Trigger execution.
    node.triggerExecution();
    await sleep(20);
    t.ok(emissions.length >= 1, "At least one emission occurs after trigger");

    // Dispose the subscriber.
    sub.unsubscribe();
    // Trigger again.
    node.triggerExecution();
    await sleep(20);
    t.is(emissions.length, 1, "No new emission occurs after unsubscribe");
});
