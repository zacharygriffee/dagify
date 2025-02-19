import { solo, test } from "brittle";
import { createBridgeNode, createNode } from "../../index.js";

// Helper function for asynchronous delays.
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test("Bridge node basic", async t => {
    const x = createNode(5);
    const y = createNode(x => x * 2, x);
    const z = createNode(y => y * 2, y);
    const bridgeNode = createBridgeNode(x, z);
    t.is(bridgeNode.value, 20, "Initial bridge node value should be 20");
});

test("Bridge node update propagation", async t => {
    // Setup: x -> y -> z, where y multiplies by 2 and z adds 3.
    const x = createNode(5);
    const y = createNode(x => x * 2, x);
    const z = createNode(y => y + 3, y);
    const bridgeNode = createBridgeNode(x, z);

    t.is(bridgeNode.value, 5 * 2 + 3, "Initial computed value should be (5*2)+3 = 13");

    // Update via the bridgeNode (which forwards to x).
    await bridgeNode.set(10);
    // Wait briefly for propagation.
    await delay(50);
    t.is(bridgeNode.value, 10 * 2 + 3, "After setting x to 10, computed value should be (10*2)+3 = 23");
});

test("Bridge node subscription receives updates", async t => {
    const x = createNode(2);
    const y = createNode(x => x + 5, x);
    const z = createNode(y => y * 3, y);
    const bridgeNode = createBridgeNode(x, z);

    let updates = [];
    const unsub = bridgeNode.skip.subscribe(val => {
        updates.push(val);
    });

    // Initial emission should occur on subscription.
    t.is(bridgeNode.value, (2 + 5) * 3, "Initial value should be 21");
    await delay(20);

    // Update the input via bridgeNode.
    await bridgeNode.set(4);
    await delay(50);
    t.is(bridgeNode.value, (4 + 5) * 3, "After update, value should be (4+5)*3 = 27");
    t.alike(updates, [21, 27], "Subscriber should receive initial and updated values");

    unsub.unsubscribe();
});

test("Bridge node propagates completion from output node", async t => {
    const x = createNode(3);
    const y = createNode(x => x * 4, x);
    // Create an output node that completes after one emission.
    const z = createNode(y => y - 2, y);
    const bridgeNode = createBridgeNode(x, z);

    let completed = false;
    bridgeNode.subscribe({
        complete: () => completed = true
    });

    // Simulate output node completion.
    z.complete();
    await delay(20);
    t.ok(completed, "Bridge node should complete when output node completes");
});
