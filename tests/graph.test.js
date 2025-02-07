import {solo, test} from "brittle";
import {createGraph, createNode} from "../index.js";
import b4a from "b4a";

test("graph basic test", async t => {
    const graph = createGraph({keyEncoding: "json"});
    const a = createNode(1);
    const b = createNode(2);
    const c = createNode(values => values.map(x => x + 10));

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);

    graph.connect(a, c);
    graph.connect(b, c);

    t.alike(c.value, [11, 12]);

    const e = createNode((values) => values.flat().reduce((acc, res) => acc * res));
    graph.addNode(e);
    graph.connect(c, e);

    t.is(e.value, 132);
});

// ─────────────────────────────────────────────
// 1. Cycle Detection Test
// ─────────────────────────────────────────────
test("cycle detection should throw error", async t => {
    const graph = createGraph({ keyEncoding: "json" });
    const a = createNode(1);
    const b = createNode(2);
    const c = createNode(values => values.reduce((acc, val) => acc + val, 0));

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);

    // Create a simple chain: a -> b -> c.
    graph.connect(a, b);
    graph.connect(b, c);

    // Attempt to connect c -> a, which would create a cycle.
    t.exception(() => graph.connect(c, a), "Connecting c -> a should throw an error because it creates a cycle.");
});

// ─────────────────────────────────────────────
// 2. Disconnect Test
// ─────────────────────────────────────────────
test("disconnecting a node updates computed value", async t => {
    // In this test, node c adds 10 to each dependency value.
    const graph = createGraph({ keyEncoding: "json" });
    const a = createNode(5);
    const b = createNode(6);
    const c = createNode(values => values.map(x => x + 10));

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);

    // Connect a and b to c.
    graph.connect(a, c);
    graph.connect(b, c);

    // Initially, c.value should be [15, 16].
    t.alike(c.value, [15, 16]);

    // Disconnect b from c.
    graph.disconnect(b, c);

    // After disconnecting, c should only see a's value.
    // Calling update() is recommended if the computed nodes recalc on demand.
    graph.update();
    t.alike(c.value, [15]);
});

// ─────────────────────────────────────────────
// 3. Remove Node Test
// ─────────────────────────────────────────────
test("removing a node updates dependencies", async t => {
    const graph = createGraph({ keyEncoding: "json" });
    const a = createNode(5);
    const b = createNode(7);
    const c = createNode(values => values.reduce((acc, x) => acc + x, 0));

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);

    // c computes the sum of its dependencies.
    graph.connect(a, c);
    graph.connect(b, c);
    t.is(c.value, 12);

    // Remove node b.
    graph.removeNode(b);
    graph.update();

    // Now, c should only depend on a.
    t.is(c.value, 5);
});

// ─────────────────────────────────────────────
// 4. Topological Sort Test
// ─────────────────────────────────────────────
test("topological sort returns a valid ordering", async t => {
    const graph = createGraph({ keyEncoding: "json" });
    const a = createNode(1);
    const b = createNode(2);
    // c sums its inputs.
    const c = createNode(values => values.reduce((acc, x) => acc + x, 0));

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);

    // Create dependencies: a -> c and b -> c.
    graph.connect(a, c);
    graph.connect(b, c);

    const order = graph.topologicalSort();

    // Encode keys for a, b, c.
    const aId = graph.encodeKey(a.id);
    const bId = graph.encodeKey(b.id);
    const cId = graph.encodeKey(c.id);

    // Convert all keys in order to hex strings.
    const orderHex = order.map(key => key.toString("hex"));
    const aHex = aId.toString("hex");
    const bHex = bId.toString("hex");
    const cHex = cId.toString("hex");

    t.ok(orderHex.indexOf(aHex) < orderHex.indexOf(cHex), "a should come before c");
    t.ok(orderHex.indexOf(bHex) < orderHex.indexOf(cHex), "b should come before c");
});

// ─────────────────────────────────────────────
// 5. Update Propagation Test
// ─────────────────────────────────────────────
test("update propagates changes through the graph", async t => {
    // Create a chain where a feeds into b, and b feeds into c.
    const graph = createGraph({ keyEncoding: "json" });
    const a = createNode(3);
    const b = createNode(([n]) => n * 2);
    const c = createNode(values => values.reduce((acc, x) => acc + x, 0));

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);

    // Set up dependencies: a -> b and b -> c.
    graph.connect(a, b);
    graph.connect(b, c);

    // Initially, b.value should be [6] (3 * 2) and c.value should be 6.
    t.alike(b.value, 6);
    t.is(c.value, 6);

    // Change a's value.
    a.value = 5;
    graph.update();

    // Now, b.value should be [10] and c.value should be 10.
    t.is(b.value, 10);
    t.is(c.value, 10);
});