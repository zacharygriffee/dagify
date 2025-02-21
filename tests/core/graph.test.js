import { solo, test } from "brittle";
import { createGraph, createNode } from "../../index.secure.js";
import z32 from "z32";

test("graph uses node keys correctly", async (t) => {
    const graph = createGraph();
    const rootNode = createNode(10);
    const childNode = createNode(([x]) => x + 5);

    graph.addNodes([rootNode, childNode]);
    graph.connect(rootNode, [childNode]);

    t.is(childNode.value, 15);
    await rootNode.set(15)
    t.is(childNode.value, 20);
});

// ─────────────────────────────────────────────
// 1. Basic Graph Test
// ─────────────────────────────────────────────
test("graph basic test", async t => {
    const graph = createGraph();
    const a = createNode(1);
    const b = createNode(2);
    const c = createNode(values => values.map(x => x + 10));

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);

    graph.connect(a, c);
    graph.connect(b, c);

    t.alike(c.value, [11, 12]);

    const e = createNode(values => values.length && values.flat().reduce((acc, res) => acc * res));
    graph.addNode(e);
    graph.connect(c, e);

    t.is(e.value, 132);
});

// ─────────────────────────────────────────────
// 2. Cycle Detection Test
// ─────────────────────────────────────────────
test("cycle detection should throw error", async t => {
    const graph = createGraph();
    const a = createNode(1);
    const b = createNode(2);
    const c = createNode(values => values.reduce((acc, val) => acc + val, 0));

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);

    // Create a chain: a -> b -> c.
    graph.connect(a, b);
    graph.connect(b, c);

    t.exception(() => graph.connect(c, a), "Connecting c -> a should throw an error because it creates a cycle.");
});

// ─────────────────────────────────────────────
// 3. Disconnect Test
// ─────────────────────────────────────────────
test("disconnecting a node updates computed value", async t => {
    const graph = createGraph();
    const a = createNode(5);
    const b = createNode(6);
    const c = createNode(values => values.map(x => x + 10));

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);

    graph.connect(a, c);
    graph.connect(b, c);

    t.alike(c.value, [15, 16]);

    graph.disconnect(b, c);
    graph.update();
    t.alike(c.value, [15]);
});

// ─────────────────────────────────────────────
// 4. Remove Node Test
// ─────────────────────────────────────────────
test("removing a node updates dependencies", async t => {
    const graph = createGraph();
    const a = createNode(5);
    const b = createNode(7);
    const c = createNode(values => values.reduce((acc, x) => acc + x, 0));

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);

    graph.connect(a, c);
    graph.connect(b, c);
    t.is(c.value, 12);

    graph.removeNode(b);
    graph.update();
    t.is(c.value, 5);
});

// ─────────────────────────────────────────────
// 5. Topological Sort Test
// ─────────────────────────────────────────────
test("topological sort returns a valid ordering", async t => {
    const graph = createGraph();
    const a = createNode(1);
    const b = createNode(2);
    const c = createNode(values => values.reduce((acc, x) => acc + x, 0));

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);

    graph.connect(a, c);
    graph.connect(b, c);

    const order = graph.topologicalSort();
    // Instead of using node.id directly, we compare the z32-encoded versions of the keys.
    const aId = a.id; // a.id === z32.encode(a.key)
    const bId = b.id;
    const cId = c.id;

    const orderStr = order.map(key => z32.encode(key));
    t.ok(orderStr.indexOf(aId) < orderStr.indexOf(cId), "a should come before c");
    t.ok(orderStr.indexOf(bId) < orderStr.indexOf(cId), "b should come before c");
});

// ─────────────────────────────────────────────
// 6. Update Propagation Test
// ─────────────────────────────────────────────
test("update propagates changes through the graph", async t => {
    const graph = createGraph();
    const a = createNode(3);
    const b = createNode(([n]) => n * 2);
    const c = createNode(values => values.reduce((acc, x) => acc + x, 0));

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);

    graph.connect(a, b);
    graph.connect(b, c);

    t.alike(b.value, 6);
    t.is(c.value, 6);

    a.value = 5;
    graph.update();

    t.is(b.value, 10);
    t.is(c.value, 10);
});

// ─────────────────────────────────────────────
// 7. getNode Overload Tests
// ─────────────────────────────────────────────
test("getNode overload returns the correct node(s)", async t => {
    const graph = createGraph();
    const a = createNode(1);
    const b = createNode(2);

    graph.addNode(a);
    graph.addNode(b);

    t.is(graph.getNode(a), a, "getNode returns the correct single node");
    t.alike(graph.getNode([a, b]), [a, b], "getNode returns an array of nodes when passed an array");
});

test("getNode should throw for non-existent nodes", async t => {
    const graph = createGraph();
    t.exception(() => graph.getNode("non-existent"), "Retrieving a non-existent node should throw an error");
});

// ─────────────────────────────────────────────
// 8. Predecessors & Successors Tests
// ─────────────────────────────────────────────
test("immediate and transitive predecessors and successors", async t => {
    const graph = createGraph();

    const A = createNode("A");
    const B = createNode("B");
    const C = createNode(values => values.join(",")); // computed node
    const D = createNode(values => values.join("-")); // computed node

    graph.addNode(A);
    graph.addNode(B);
    graph.addNode(C);
    graph.addNode(D);

    graph.connect(A, C);
    graph.connect(B, C);
    graph.connect(C, D);

    const immPredC = graph.getImmediatePredecessors(C);
    t.ok(immPredC.includes(A), "A is an immediate predecessor of C");
    t.ok(immPredC.includes(B), "B is an immediate predecessor of C");
    t.is(immPredC.length, 2, "C has exactly 2 immediate predecessors");

    const transPredD = graph.getPredecessors(D, { transitive: true });
    t.ok(transPredD.includes(C), "C is a transitive predecessor of D");
    t.ok(transPredD.includes(A), "A is a transitive predecessor of D");
    t.ok(transPredD.includes(B), "B is a transitive predecessor of D");
    t.is(transPredD.length, 3, "D has exactly 3 transitive predecessors");

    const immSuccA = graph.getImmediateSuccessors(A);
    t.alike(immSuccA, [C], "A has exactly one immediate successor (C)");

    const transSuccA = graph.getSuccessors(A, { transitive: true });
    t.ok(transSuccA.includes(C), "C is a transitive successor of A");
    t.ok(transSuccA.includes(D), "D is a transitive successor of A");
    t.is(transSuccA.length, 2, "A has exactly 2 transitive successors");
});

// ─────────────────────────────────────────────
// 9. Sources and Sinks Tests
// ─────────────────────────────────────────────
test("retrieving sources and sinks", async t => {
    const graph = createGraph();

    const a = createNode("a");
    const b = createNode("b");
    const c = createNode("c");
    const d = createNode("d");

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);
    graph.addNode(d);

    graph.connect(a, b);
    graph.connect(a, c);
    graph.connect(c, d);

    const sources = graph.getSources();
    t.alike(sources, [a], "Only node 'a' is a source");

    const sinks = graph.getSinks();
    t.ok(sinks.includes(b), "Node 'b' is a sink");
    t.ok(sinks.includes(d), "Node 'd' is a sink");
    t.is(sinks.length, 2, "There are exactly 2 sink nodes");
});

// ─────────────────────────────────────────────
// 10. updateAsync Test
// ─────────────────────────────────────────────
test("updateAsync updates nodes asynchronously", async t => {
    const graph = createGraph();

    const a = createNode(3);
    const b = createNode(([val]) => val * 2);
    // Override update() to simulate async behavior.
    b.update = async function() {
        this.value = this.fn([a.value]);
        return new Promise(resolve => setTimeout(resolve, 10));
    };

    graph.addNode(a);
    graph.addNode(b);
    graph.connect(a, b);

    await graph.updateAsync();
    t.is(b.value, 6, "updateAsync correctly updated computed node b (3 * 2 = 6)");
});

// ─────────────────────────────────────────────
// 11. toString Test
// ─────────────────────────────────────────────
test("toString returns correct string representation", t => {
    const graph = createGraph();
    const a = createNode("a");
    const b = createNode("b");
    const c = createNode("c");

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);

    graph.connect(a, b);
    graph.connect(b, c);
    graph.connect(a, c);

    const str = graph.toString();
    t.ok(str.includes(`${a.id} -> ${b.id}`), "toString contains 'a -> b'");
    t.ok(str.includes(`${b.id} -> ${c.id}`), "toString contains 'b -> c'");
    t.ok(str.includes(`${a.id} -> ${c.id}`), "toString contains 'a -> c'");
});

// ─────────────────────────────────────────────
// 12. findPath Test
// ─────────────────────────────────────────────
test("findPath returns a valid path between nodes", t => {
    const graph = createGraph();
    const a = createNode("a");
    const b = createNode("b");
    const c = createNode("c");
    const d = createNode("d");

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);
    graph.addNode(d);

    graph.connect(a, b);
    graph.connect(b, c);
    graph.connect(c, d);

    const path = graph.findPath(a, d);
    t.ok(Array.isArray(path), "findPath returns an array of Buffer keys");
    t.is(z32.encode(path[0]), a.id, "Path starts with node 'a'");
    t.is(z32.encode(path[path.length - 1]), d.id, "Path ends with node 'd'");

    const e = createNode("e");
    graph.addNode(e);
    const noPath = graph.findPath(d, e);
    t.is(noPath, null, "findPath returns null when no path exists");
});

// ─────────────────────────────────────────────
// 13. Graph Introspection Tests (getInDegree, getOutDegree, hasNode, hasEdge)
// ─────────────────────────────────────────────
test("Graph introspection functions work correctly", t => {
    const graph = createGraph();
    const a = createNode("a");
    const b = createNode("b");
    const c = createNode("c");

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);

    graph.connect(a, b);
    graph.connect(a, c);
    graph.connect(b, c);

    t.is(graph.getInDegree(b), 1, "Node 'b' has in-degree 1");
    t.is(graph.getInDegree(c), 2, "Node 'c' has in-degree 2");
    t.is(graph.getOutDegree(a), 2, "Node 'a' has out-degree 2");
    t.is(graph.getOutDegree(b), 1, "Node 'b' has out-degree 1");

    t.ok(graph.hasNode(a), "Graph reports node 'a' exists");
    t.exception(() => graph.hasNode("non-existent"), "Graph throws with unsupported id.");

    t.ok(graph.hasEdge(a, b), "Edge a -> b exists");
    t.ok(!graph.hasEdge(b, a), "Edge b -> a does not exist");
});

// ─────────────────────────────────────────────
// 14. clear Test
// ─────────────────────────────────────────────
test("clear empties the graph", t => {
    const graph = createGraph();
    const a = createNode("a");
    const b = createNode("b");

    graph.addNode(a);
    graph.addNode(b);
    graph.connect(a, b);

    graph.clear();

    t.is(graph.nodes.size, 0, "Graph nodes cleared");
    t.is(graph.edges.size, 0, "Graph edges cleared");
});

// ─────────────────────────────────────────────
// 15. getConnectedComponent Test
// ─────────────────────────────────────────────
test("getConnectedComponent returns correct connected components", t => {
    const graph = createGraph();
    const a = createNode("a");
    const b = createNode("b");
    const c = createNode("c");
    const d = createNode("d");
    const e = createNode("e");

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);
    graph.addNode(d);
    graph.addNode(e);

    // Component 1: a -> b -> c.
    graph.connect(a, b);
    graph.connect(b, c);
    // Component 2: d -> e.
    graph.connect(d, e);

    const comp1 = graph.getConnectedComponent(b);
    t.ok(comp1.some(n => n.id === a.id), "comp1 includes a");
    t.ok(comp1.some(n => n.id === b.id), "comp1 includes b");
    t.ok(comp1.some(n => n.id === c.id), "comp1 includes c");
    t.absent(comp1.some(n => n.id === d.id), "comp1 does not include d");
    t.absent(comp1.some(n => n.id === e.id), "comp1 does not include e");

    const comp2 = graph.getConnectedComponent(d);
    t.ok(comp2.some(n => n.id === d.id), "comp2 includes d");
    t.ok(comp2.some(n => n.id === e.id), "comp2 includes e");
    t.absent(comp2.some(n => n.id === a.id), "comp2 does not include a");
});
