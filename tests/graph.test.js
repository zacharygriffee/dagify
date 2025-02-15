import {solo, test} from "brittle";
import {createGraph, createNode} from "../index.js";

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

// ─────────────────────────────────────────────
// 6. getNode Overload Tests
// ─────────────────────────────────────────────
test("getNode overload returns the correct node(s)", async t => {
    const graph = createGraph({ keyEncoding: "json" });
    const a = createNode(1);
    const b = createNode(2);

    graph.addNode(a);
    graph.addNode(b);

    // Test single node retrieval.
    t.is(graph.getNode(a), a, "getNode returns the correct single node");

    // Test retrieval using an array.
    t.alike(graph.getNode([a, b]), [a, b], "getNode returns an array of nodes when passed an array");
});

test("getNode should throw for non-existent nodes", async t => {
    const graph = createGraph({ keyEncoding: "json" });
    t.exception(() => graph.getNode("non-existent"), "Retrieving a node that does not exist should throw an error");
});

// ─────────────────────────────────────────────
// 7. Predecessors & Successors Tests
// ─────────────────────────────────────────────
test("immediate and transitive predecessors and successors", async t => {
    const graph = createGraph({ keyEncoding: "json" });

    // Create four nodes.
    const A = createNode("A");
    const B = createNode("B");
    const C = createNode(values => values.join(",")); // computed node
    const D = createNode(values => values.join("-")); // computed node

    // Add nodes to the graph.
    graph.addNode(A);
    graph.addNode(B);
    graph.addNode(C);
    graph.addNode(D);

    // Build the graph:
    // A ──►
    //       C ──► D
    // B ──►
    graph.connect(A, C);
    graph.connect(B, C);
    graph.connect(C, D);

    // Immediate predecessors:
    const immPredC = graph.getImmediatePredecessors(C);
    t.ok(immPredC.includes(A), "A is an immediate predecessor of C");
    t.ok(immPredC.includes(B), "B is an immediate predecessor of C");
    t.is(immPredC.length, 2, "C has exactly 2 immediate predecessors");

    // Transitive predecessors:
    const transPredD = graph.getPredecessors(D, { transitive: true });
    t.ok(transPredD.includes(C), "C is a transitive predecessor of D");
    t.ok(transPredD.includes(A), "A is a transitive predecessor of D");
    t.ok(transPredD.includes(B), "B is a transitive predecessor of D");
    t.is(transPredD.length, 3, "D has exactly 3 transitive predecessors");

    // Immediate successors:
    const immSuccA = graph.getImmediateSuccessors(A);
    t.alike(immSuccA, [C], "A has exactly one immediate successor (C)");

    // Transitive successors:
    const transSuccA = graph.getSuccessors(A, { transitive: true });
    t.ok(transSuccA.includes(C), "C is a transitive successor of A");
    t.ok(transSuccA.includes(D), "D is a transitive successor of A");
    t.is(transSuccA.length, 2, "A has exactly 2 transitive successors");
});

// ─────────────────────────────────────────────
// 8. Sources and Sinks Tests
// ─────────────────────────────────────────────
test("retrieving sources and sinks", async t => {
    const graph = createGraph({ keyEncoding: "json" });

    // Create four nodes.
    const a = createNode("a");
    const b = createNode("b");
    const c = createNode("c");
    const d = createNode("d");

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);
    graph.addNode(d);

    // Build connections:
    // a ──► b
    // │
    // └──► c ──► d
    graph.connect(a, b);
    graph.connect(a, c);
    graph.connect(c, d);

    // Sources: Nodes with no incoming edges.
    const sources = graph.getSources();
    t.alike(sources, [a], "Only node 'a' is a source");

    // Sinks: Nodes with no outgoing edges.
    // In this graph, b and d have no outgoing edges.
    const sinks = graph.getSinks();
    t.ok(sinks.includes(b), "Node 'b' is a sink");
    t.ok(sinks.includes(d), "Node 'd' is a sink");
    t.is(sinks.length, 2, "There are exactly 2 sink nodes");
});


// ─────────────────────────────────────────────
// 1. Test updateAsync()
// ─────────────────────────────────────────────
test("updateAsync updates nodes asynchronously", async t => {
    const graph = createGraph({ keyEncoding: "json" });

    // A constant node with a value.
    const a = createNode(3);

    // A computed node that doubles the value of node a.
    const b = createNode(([val]) => val * 2);
    // Override the update() method to simulate an asynchronous computation.
    b.update = async function() {
        this.value = this.fn([a.value]);
        // Simulate a small async delay.
        return new Promise(resolve => setTimeout(resolve, 10));
    };

    graph.addNode(a);
    graph.addNode(b);
    graph.connect(a, b);

    await graph.updateAsync();
    t.is(b.value, 6, "updateAsync correctly updated computed node b (3 * 2 = 6)");
});

// ─────────────────────────────────────────────
// 2. Test toString()
// ─────────────────────────────────────────────
test("toString returns correct string representation", t => {
    const graph = createGraph({ keyEncoding: "json" });
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
    t.ok(str.includes(`${a.id} -> ${b.id}`), "toString output contains 'a -> b'");
    t.ok(str.includes(`${b.id} -> ${c.id}`), "toString output contains 'b -> c'");
    t.ok(str.includes(`${a.id} -> ${c.id}`), "toString output contains 'a -> c'");
});

// ─────────────────────────────────────────────
// 3. Test findPath()
// ─────────────────────────────────────────────
test("findPath returns a valid path between nodes", t => {
    const graph = createGraph({ keyEncoding: "json" });
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
    t.is(graph.decodeKey(path[0]), a.id, "Path starts with node 'a'");
    t.is(graph.decodeKey(path[path.length - 1]), d.id, "Path ends with node 'd'");

    // Test for a case where no path exists.
    const e = createNode("e");
    graph.addNode(e);
    const noPath = graph.findPath(d, e);
    t.is(noPath, null, "findPath returns null when no path exists");
});

// ─────────────────────────────────────────────
// 4. Test getInDegree, getOutDegree, hasNode, and hasEdge
// ─────────────────────────────────────────────
test("Graph introspection functions work correctly", t => {
    const graph = createGraph({ keyEncoding: "json" });
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

    t.ok(graph.hasNode(a), "Graph reports that node 'a' exists");
    t.absent(graph.hasNode("non-existent"), "Graph correctly reports non-existent node");

    t.ok(graph.hasEdge(a, b), "Edge from 'a' to 'b' exists");
    t.ok(!graph.hasEdge(b, a), "Edge from 'b' to 'a' does not exist");
});

// ─────────────────────────────────────────────
// 5. Test clear()
// ─────────────────────────────────────────────
test("clear empties the graph", t => {
    const graph = createGraph({ keyEncoding: "json" });
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
// 6. Test getConnectedComponent()
// ─────────────────────────────────────────────
test("Graph introspection functions work correctly", t => {
    const graph = createGraph({ keyEncoding: "json" });
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

    t.ok(graph.hasNode(a), "Graph reports that node 'a' exists");
    t.absent(graph.hasNode("non-existent"), "Graph correctly reports non-existent node");

    t.ok(graph.hasEdge(a, b), "Edge from 'a' to 'b' exists");
    t.absent(graph.hasEdge(b, a), "Edge from 'b' to 'a' does not exist");
});

// ─────────────────────────────────────────────
// 5. Test clear()
// ─────────────────────────────────────────────
test("clear empties the graph", t => {
    const graph = createGraph({ keyEncoding: "json" });
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
// 6. Test getConnectedComponent()
// ─────────────────────────────────────────────
test("getConnectedComponent returns correct connected components", t => {
    const graph = createGraph({ keyEncoding: "json" });
    // Create nodes for two separate components.
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

    // Component 1: a, b, c (a -> b -> c)
    graph.connect(a, b);
    graph.connect(b, c);
    // Component 2: d, e (d -> e)
    graph.connect(d, e);

    const comp1 = graph.getConnectedComponent(b);
    t.ok(comp1.some(n => n.id === a.id), "Connected component for 'b' includes 'a'");
    t.ok(comp1.some(n => n.id === b.id), "Connected component for 'b' includes 'b'");
    t.ok(comp1.some(n => n.id === c.id), "Connected component for 'b' includes 'c'");
    t.absent(comp1.some(n => n.id === d.id), "Connected component for 'b' does not include 'd'");
    t.absent(comp1.some(n => n.id === e.id), "Connected component for 'b' does not include 'e'");

    const comp2 = graph.getConnectedComponent(d);
    t.ok(comp2.some(n => n.id === d.id), "Connected component for 'd' includes 'd'");
    t.ok(comp2.some(n => n.id === e.id), "Connected component for 'd' includes 'e'");
    t.absent(comp2.some(n => n.id === a.id), "Connected component for 'd' does not include 'a'");
});

// ─────────────────────────────────────────────
// Test for addNodes using both direct and tuple formats
// ─────────────────────────────────────────────
test("addNodes adds multiple nodes in both direct and tuple formats", async t => {
    const graph = createGraph({ keyEncoding: "json" });

    // Create some nodes.
    const node1 = createNode(1);
    const node2 = createNode(2);
    const node3 = createNode(3);

    // Add nodes using the direct format (node objects).
    graph.addNodes([node1, node2]);

    // Add node3 using the tuple format with a custom id.
    graph.addNodes([["custom-node3", node3]]);

    // Verify that the graph has all nodes.
    t.ok(graph.hasNode(node1), "Graph contains node1 using its generated id");
    t.ok(graph.hasNode(node2), "Graph contains node2 using its generated id");
    t.ok(graph.hasNode("custom-node3"), "Graph contains node3 using its custom id");

    // Verify that getNode returns the correct node for the custom id.
    t.is(graph.getNode("custom-node3"), node3, "getNode returns node3 for custom id");
});

// ─────────────────────────────────────────────
// Test for connect overloads accepting arrays and single nodes
// ─────────────────────────────────────────────
test("connect overload supports mixed array and single node arguments", async t => {
    const graph = createGraph({ keyEncoding: "json" });

    // Create nodes.
    const a = createNode(10);
    const b = createNode(20);
    const c = createNode(30);
    // d is a computed node that sums its dependency values.
    const d = createNode((...values) => values.reduce((acc, x) => acc + x, 0));

    // Add nodes to the graph.
    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);
    graph.addNode(d);

    // 1. Connect single source to an array of targets:
    // Connect node 'a' to both 'b' and 'c'
    graph.connect(a, [b, c]);

    // 2. Connect an array of sources to a single target:
    // Connect both 'b' and 'c' to computed node 'd'
    graph.connect([b, c], d);

    // For computed node d, its dependency values should be [20, 30] so d.value should be 50.
    t.is(d.value, 50, "d's computed value equals 20 + 30 (50)");

    // 3. Test connecting arrays for both source and target:
    // Create additional nodes.
    const e = createNode(5);
    const f = createNode(6);
    // g is a computed node that multiplies its dependency values.
    const g = createNode(values => values.reduce((acc, x) => acc * x, 1));

    // Add nodes using addNodes (mixing direct format).
    graph.addNodes([e, f]);
    graph.addNode(g);

    // Connect an array of sources to an array of targets:
    // Connect nodes 'a' and 'b' to both 'e' and 'f'
    graph.connect([a, b], [e, f]);
    // Then, connect nodes 'e' and 'f' to computed node 'g'
    graph.connect([e, f], g);

    // Since e.value = 5 and f.value = 6, g.value should equal 30.
    t.is(g.value, 30, "g's computed value equals 5 * 6 (30)");
});

// ─────────────────────────────────────────────
// 1. Test Overloaded disconnect()
// ─────────────────────────────────────────────
test("disconnect overload works", async t => {
    const graph = createGraph({ keyEncoding: "utf8" });

    // Create nodes.
    const a = createNode("A");
    const b = createNode("B");
    const c = createNode("C");
    const d = createNode("D");

    // Add nodes to the graph.
    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);
    graph.addNode(d);

    // Create connections:
    // a -> b and a -> c, plus b -> d and c -> d.
    graph.connect(a, [b, c]);
    graph.connect(b, d);
    graph.connect(c, d);

    // Verify that the expected edges exist.
    t.ok(graph.hasEdge(a, b), "Edge A -> B exists");
    t.ok(graph.hasEdge(a, c), "Edge A -> C exists");
    t.ok(graph.hasEdge(b, d), "Edge B -> D exists");
    t.ok(graph.hasEdge(c, d), "Edge C -> D exists");

    // Disconnect A from both B and C using an array for the target.
    graph.disconnect(a, [b, c]);
    t.absent(graph.hasEdge(a, b), "Edge A -> B removed");
    t.absent(graph.hasEdge(a, c), "Edge A -> C removed");

    // The remaining edges should still exist.
    t.ok(graph.hasEdge(b, d), "Edge B -> D still exists");
    t.ok(graph.hasEdge(c, d), "Edge C -> D still exists");

    // Now disconnect multiple sources from a single target.
    graph.disconnect([b, c], d);
    t.absent(graph.hasEdge(b, d), "Edge B -> D removed");
    t.absent(graph.hasEdge(c, d), "Edge C -> D removed");
});

// ─────────────────────────────────────────────
// 2. Test getNodes()
// ─────────────────────────────────────────────
test("getNodes returns all nodes", async t => {
    const graph = createGraph({ keyEncoding: "utf8" });

    // Create nodes.
    const a = createNode("A");
    const b = createNode("B");
    const c = createNode("C");

    // Add nodes using addNodes.
    graph.addNodes([a, b, c]);

    const nodes = graph.getNodes();
    t.is(nodes.length, 3, "getNodes returns three nodes");
    t.ok(nodes.includes(a), "Nodes include A");
    t.ok(nodes.includes(b), "Nodes include B");
    t.ok(nodes.includes(c), "Nodes include C");
});

// ─────────────────────────────────────────────
// 3. Test getEdges()
// ─────────────────────────────────────────────
test("getEdges returns all edges", async t => {
    const graph = createGraph({ keyEncoding: "utf8" });

    // Create nodes.
    const a = createNode("A");
    const b = createNode("B");
    const c = createNode("C");

    // Add nodes.
    graph.addNodes([a, b, c]);

    // Connect nodes: A -> B, A -> C, and B -> C.
    graph.connect(a, [b, c]);
    graph.connect(b, c);

    const edges = graph.getEdges();
    t.is(edges.length, 3, "getEdges returns three edges");

    // Validate each edge by checking the source and target node ids.
    const edgeAB = edges.find(edge => edge.src.id === a.id && edge.tgt.id === b.id);
    const edgeAC = edges.find(edge => edge.src.id === a.id && edge.tgt.id === c.id);
    const edgeBC = edges.find(edge => edge.src.id === b.id && edge.tgt.id === c.id);

    t.ok(edgeAB, "Edge A -> B exists in getEdges");
    t.ok(edgeAC, "Edge A -> C exists in getEdges");
    t.ok(edgeBC, "Edge B -> C exists in getEdges");
});

// ─────────────────────────────────────────────
// 4. Test findNode()
// ─────────────────────────────────────────────
test("findNode returns the correct node based on value", async t => {
    const graph = createGraph({ keyEncoding: "utf8" });

    // Create nodes with distinctive values.
    const a = createNode("A");
    const b = createNode("B");
    const target = createNode("TARGET");

    // Add nodes.
    graph.addNodes([a, b, target]);

    // Use findNode with a predicate to match the target node by its value.
    const found = graph.findNode(node => node.value === "TARGET");
    t.is(found, target, "findNode returns the node with value TARGET");

    // Test that findNode returns null when no node matches.
    const notFound = graph.findNode(node => node.value === "NON_EXISTENT");
    t.is(notFound, null, "findNode returns null when no node matches");
});
