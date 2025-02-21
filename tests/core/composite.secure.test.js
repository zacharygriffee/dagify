import { solo, test } from "brittle";
import { createNode } from "../../index.secure.js";
import { Composite } from "../../lib/composite/Composite.js";
import { interval, take } from "rxjs";

// Helper function for async delays
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/* -------------------------------
   Array Mode Tests for Composite
---------------------------------*/

test("Composite should initialize with correct values", (t) => {
    const node1 = createNode(1);
    const node2 = createNode(2);
    const comp = new Composite([node1, node2]);

    t.alike(comp.value, [1, 2], "Composite should hold initial values");
});

test("Composite subscription receives updates on node changes", async (t) => {
    t.plan(3);

    const node1 = createNode(1);
    const node2 = createNode(2);
    const comp = new Composite([node1, node2]);

    let callCount = 0;
    const unsubscribe = comp.subscribe(values => {
        callCount++;
        if (callCount === 1) {
            t.alike(values, [1, 2], "Initial snapshot is correct");
        } else if (callCount === 2) {
            t.alike(values, [10, 2], "Snapshot after updating node1 is correct");
        } else if (callCount === 3) {
            t.alike(values, [10, 20], "Snapshot after updating node2 is correct");
        }
    });

    node1.set(10);
    node2.set(20);
    await delay(50);
    unsubscribe.unsubscribe();
});

test("Composite should detect async nodes and mark itself async", (t) => {
    const node1 = createNode(1);
    const node2 = createNode(interval(1000).pipe(take(3))); // Async node
    const comp = new Composite([node1, node2]);

    t.ok(comp.isAsync, "Composite should be marked async when an async node is present");
});

test("Composite should support adding and removing nodes", async (t) => {
    t.plan(3);

    const node1 = createNode(1);
    const node2 = createNode(2);
    const node3 = createNode(3);
    const comp = new Composite([node1, node2]);

    let callCount = 0;
    comp.subscribe(values => {
        callCount++;
        if (callCount === 1) {
            t.alike(values, [1, 2], "Initial snapshot is correct");
        } else if (callCount === 2) {
            t.alike(values, [1, 2, 3], "Snapshot after adding node3 is correct");
        } else if (callCount === 3) {
            t.alike(values, [1, 3], "Snapshot after removing node2 is correct");
        }
    });

    comp.addNodes(node3);
    await delay(50);
    comp.removeNodes(node2);
    await delay(50);
});

/* -------------------------------
   Object Mode Tests for Composite
---------------------------------*/

test("Composite object mode should initialize with correct values", (t) => {
    const node1 = createNode(1);
    const node2 = createNode(2);
    // Create Composite in object mode with keys "first" and "second"
    const comp = new Composite({ first: node1, second: node2 });

    t.alike(comp.value, { first: 1, second: 2 }, "Composite object mode holds initial values");
});

test("Composite object mode subscription receives updates on node changes", async (t) => {
    t.plan(3);

    const node1 = createNode(1);
    const node2 = createNode(2);
    const comp = new Composite({ first: node1, second: node2 });

    let callCount = 0;
    const unsubscribe = comp.subscribe(values => {
        callCount++;
        if (callCount === 1) {
            t.alike(values, { first: 1, second: 2 }, "Initial snapshot is correct");
        } else if (callCount === 2) {
            t.alike(values, { first: 10, second: 2 }, "Snapshot after updating node1 is correct");
        } else if (callCount === 3) {
            t.alike(values, { first: 10, second: 20 }, "Snapshot after updating node2 is correct");
        }
    });

    node1.set(10);
    node2.set(20);
    await delay(50);
    unsubscribe.unsubscribe();
});

test("Composite object mode should detect async nodes and mark itself async", (t) => {
    const node1 = createNode(1);
    const node2 = createNode(interval(1000).pipe(take(3))); // Async node
    const comp = new Composite({ first: node1, second: node2 });

    t.ok(comp.isAsync, "Composite object mode should be marked async when an async node is present");
});

test("Composite object mode should support adding and removing nodes", async (t) => {
    t.plan(3);

    const node1 = createNode(1);
    const node2 = createNode(2);
    const node3 = createNode(3);
    // Start in object mode with keys "a" and "b"
    const comp = new Composite({ a: node1, b: node2 });

    let callCount = 0;
    comp.subscribe(values => {
        callCount++;
        if (callCount === 1) {
            t.alike(values, { a: 1, b: 2 }, "Initial snapshot is correct");
        } else if (callCount === 2) {
            // After adding node3 with key "c"
            t.alike(values, { a: 1, b: 2, c: 3 }, "Snapshot after adding node3 is correct");
        } else if (callCount === 3) {
            // After removing node with key "b"
            t.alike(values, { a: 1, c: 3 }, "Snapshot after removing node2 is correct");
        }
    });

    comp.addNodes({ c: node3 });
    await delay(50);
    comp.removeNodes("b");
    await delay(50);
});

/* -------------------------------
   Additional Tests
---------------------------------*/

// 1. Test that duplicate values do not trigger extra emissions.
test("Composite should not emit duplicate values when a node is updated with a deepEqual value", async (t) => {
    t.plan(1);

    const node = createNode({ a: 1 });
    const comp = new Composite([node]);

    let emissionCount = 0;
    comp.subscribe(() => {
        emissionCount++;
    });

    // Update the node with an object that is deepEqual to the current value.
    node.set({ a: 1 });
    await delay(50);

    t.is(emissionCount, 1, "No duplicate emission should occur if the value is deeply equal");
});

// 2. Test unsubscribing stops further emissions.
test("Composite unsubscribing should prevent further emissions", async (t) => {
    t.plan(1);

    const node = createNode(1);
    const comp = new Composite([node]);

    let callCount = 0;
    const unsubscribe = comp.subscribe(() => callCount++);

    // Trigger one update.
    node.set(2);
    await delay(50);
    unsubscribe.unsubscribe();

    // Trigger another update.
    node.set(3);
    await delay(50);

    t.is(callCount, 2, "After unsubscribing, no further emissions should occur");
});

// 3. Test the toObservable conversion.
test("Composite toObservable should emit the correct values", async (t) => {
    t.plan(2);

    const node1 = createNode(1);
    const node2 = createNode(2);
    const comp = new Composite([node1, node2]);

    const emittedValues = [];
    const subscription = comp.toObservable().subscribe(values => {
        emittedValues.push(values);
    });

    // Wait for initial emission.
    await delay(20);
    t.ok(emittedValues.length >= 1, "Should emit an initial value");

    // Update one of the nodes.
    node1.set(10);
    await delay(50);
    subscription.unsubscribe();

    t.ok(emittedValues.some(val => Array.isArray(val) && val[0] === 10), "Should emit updated values via toObservable");
});

// 4. Test that complete() unsubscribes from all nodes and stops emissions.
test("Composite complete should unsubscribe from all nodes and prevent further emissions", async (t) => {
    t.plan(1);

    const node = createNode(1);
    const comp = new Composite([node]);

    let emissionCount = 0;
    comp.subscribe(() => emissionCount++);

    // Update the node.
    node.set(2);
    await delay(50);
    comp.complete();
    // Attempt another update.
    node.set(3);
    await delay(50);

    t.is(emissionCount, 2, "No emissions should occur after complete is called");
});

test("Test that a Composite can utilize computed nodes and reflect dynamic dependency updates", async (t) => {
    // Create a base node with initial value 1.
    const node = createNode(1);

    // Create a computed node that adds 1 to its dependency.
    const computed = createNode(([x]) => x + 1, [node]);

    // Create a composite containing the computed node.
    const comp = new Composite([computed]);

    // Initially, the computed node should be 1 + 1 = 2.
    t.alike(comp.value, [2], "Initial composite value should be [2]");

    // Update the dependency node from 1 to 3. The computed node should update to 3 + 1 = 4.
    node.set(3);
    await delay(50);
    t.alike(comp.value, [4], "Composite should reflect updated computed node value [4] after dependency change");

    // Listen for updates on the computed node.
    let updateCount = 0;
    const unsubscribe = computed.skip.subscribe(() => {
        updateCount++;
    });

    // Set the dependency to the same value (3), which should not change the computed value (still 4).
    node.set(3);
    await delay(50);
    t.is(updateCount, 0, "No duplicate update should occur if dependency set to a value that doesn't change computed result");

    // Update the dependency to 5. The computed node should update to 5 + 1 = 6.
    node.set(5);
    await delay(50);
    t.alike(comp.value, [6], "Composite should reflect computed node value [6] after updating dependency to 5");

    // Clean up
    unsubscribe.unsubscribe();
});

test("Composite update should force emission even if value hasn't changed", async (t) => {
    t.plan(3);
    const node = createNode(42);
    const comp = new Composite([node]);

    const emissions = [];
    const unsubscribe = comp.subscribe(val => {
        emissions.push(val);
    });

    // Allow the initial emission.
    await delay(50);
    const initialEmissionCount = emissions.length;

    // Call update() to force an emission.
    comp.update();
    await delay(50);
    t.is(emissions.length, initialEmissionCount + 1, "update() forces an emission even if value is unchanged");

    // Change the node's value and force an update.
    node.set(100);
    await delay(50);
    comp.update();
    await delay(50);

    // The emission before forced update should reflect the updated value.
    t.is(emissions[emissions.length - 2][0], 100, "Composite emitted updated value before forced update");
    // The forced emission should emit the same updated value.
    t.is(emissions[emissions.length - 1][0], 100, "Forced update emits the correct updated value");

    unsubscribe.unsubscribe();
});

// Test for array-mode Composite: partial update should update matching indexes only.
test("Composite set in array mode with partial array update updates matching indexes only", async (t) => {
    t.plan(3);
    const node1 = createNode(1);
    const node2 = createNode(2);
    const node3 = createNode(3);
    const comp = new Composite([node1, node2, node3]);

    // Provide only two values, so only node1 and node2 should update.
    comp.set([10, 20]);
    await delay(50);

    t.alike(node1.value, 10, "Node 1 should update to 10");
    t.alike(node2.value, 20, "Node 2 should update to 20");
    t.alike(node3.value, 3, "Node 3 should remain unchanged");
});

// Test for array-mode Composite: extra values in the update array should be ignored.
test("Composite set in array mode with extra values ignores extra values", async (t) => {
    t.plan(3);
    const node1 = createNode(1);
    const node2 = createNode(2);
    const comp = new Composite([node1, node2]);

    // Provide three values, but the composite only has two nodes.
    comp.set([10, 20, 30]);
    await delay(50);

    t.alike(node1.value, 10, "Node 1 should update to 10");
    t.alike(node2.value, 20, "Node 2 should update to 20");
    t.alike(comp.value, [10, 20], "Composite should only include the first two values");
});

// Test for object-mode Composite: keys that don't match any dependency are ignored.
test("Composite set in object mode with non-matching keys should ignore those keys", async (t) => {
    t.plan(2);
    const node1 = createNode(1);
    const node2 = createNode(2);
    const comp = new Composite({ a: node1, b: node2 });

    // Call set with a key "c" that doesn't exist in the composite.
    comp.set({ a: 100, c: 300 });
    await delay(50);

    t.alike(node1.value, 100, "Node 'a' should update to 100");
    t.alike(comp.value, { a: 100, b: 2 }, "Composite should ignore key 'c' and leave node 'b' unchanged");
});
