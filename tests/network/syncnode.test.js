import { solo, test, skip } from "brittle";
import {createComposite, createNode} from "../../index.js";
import duplexThrough from "duplex-through";
import {sleep} from "../helpers/sleep.js";
import {syncNode} from "../../lib/network/syncNode.js";

test("share a node", async (t) => {
    const [s1, s2] = duplexThrough();
    const node = createNode("hello");
    const { sync: remoteSync } = syncNode(node, {
        valueEncoding: "utf8"
    });

    const { sync: localSync, node: replicatedNode } = syncNode(node.key, {
        valueEncoding: "utf8"
    });

    await Promise.all(
        [
            remoteSync(s1),
            localSync(s2)
        ]
    );

    t.is(node.id, replicatedNode.id);
    t.is(replicatedNode.value, node.value);

    const bNode = createNode((str) => str + " world", replicatedNode);
    t.is(bNode.value, "hello world");

    node.set("world");
    await sleep(10);
    t.is(bNode.value, "world world");
});

test("transform mode sync prevents echo", async (t) => {
    const [s1, s2] = duplexThrough();
    // Create a node with initial state "foo"
    const node = createNode("foo");

    // Share node from the remote side (using transform mode)
    const { sync: remoteSync } = syncNode(node, {
        valueEncoding: "utf8",
        mode: "transform"
    });

    // Load node from the remote key on the local side
    const { sync: localSync, node: replicatedNode } = syncNode(node.key, {
        valueEncoding: "utf8",
        mode: "transform"
    });

    await Promise.all([remoteSync(s1), localSync(s2)]);

    // Check that initial state is in sync
    t.is(node.id, replicatedNode.id);
    t.is(replicatedNode.value, "foo");

    // Update on remote side
    node.set("bar");
    await sleep(10);
    t.is(replicatedNode.value, "bar");

    // Now update on local replica (which should not echo back unnecessarily)
    replicatedNode.set("baz");
    await sleep(10);
    t.is(node.value, "baz");
});

test("source mode: local sends updates", async (t) => {
    const [s1, s2] = duplexThrough();
    // Create a local node with initial state
    const node = createNode("initial");

    // On the local side, we use an existing node (source mode means this node sends updates)
    const { sync: localSync } = syncNode(node, {
        valueEncoding: "utf8",
        mode: "source"
    });

    // On the remote side, we load the node from key
    const { sync: remoteSync, node: replicatedNode } = syncNode(node.key, {
        valueEncoding: "utf8",
        mode: "sink"
    });

    await Promise.all([localSync(s1), remoteSync(s2)]);
    await sleep(100);
    // Remote node should initially match the local state
    t.is(replicatedNode.value, "initial");

    // Update local node; remote node should receive the update
    node.set("updated");
    await sleep(100);
    t.is(replicatedNode.value, "updated");
});

test("sink mode: local receives updates only", async (t) => {
    const [s1, s2] = duplexThrough();
    // Create a remote node with initial state
    const remoteNode = createNode("remote");

    // Remote side in source mode sends updates.
    const { sync: remoteSync } = syncNode(remoteNode, {
        valueEncoding: "utf8",
        mode: "source"
    });

    // Local side in sink mode only receives updates.
    const { sync: localSync, node: replicatedNode } = syncNode(remoteNode.key, {
        valueEncoding: "utf8",
        mode: "sink"
    });

    await Promise.all([remoteSync(s1), localSync(s2)]);

    // Initial state should be synced
    await sleep(100);
    t.is(replicatedNode.value, "remote");

    // Update remote node, local should receive update.
    remoteNode.set("changed");
    await sleep(10);
    t.is(replicatedNode.value, "changed");

    // Changing the local node should have no effect since it's sink mode.
    replicatedNode.set("local change");
    await sleep(10);
    t.is(remoteNode.value, "changed");
});

solo("share a composite", async (t) => {
    const [s1, s2] = duplexThrough();
    const helloNode = createNode("hello");
    const worldNode = createNode("world");
    const composite = createComposite([helloNode, worldNode]);
    const { sync: remoteSync } = syncNode(composite, {
        valueEncoding: "array(utf8)"
    });

    const { sync: localSync, node: replicatedNode } = syncNode(composite.key, {
        valueEncoding: "array(utf8)"
    });

    await Promise.all(
        [
            remoteSync(s1),
            localSync(s2)
        ]
    );

    t.is(composite.id, replicatedNode.id);
    t.alike(replicatedNode.value, composite.value);

    const bNode = createNode((str) => str, replicatedNode);
    await sleep(10);
    t.is(bNode.value.join(" "), "hello world");

    composite.set("world");
    await sleep(10);

    t.is(bNode.value.join(" "), "world world");
    replicatedNode.set(["foo", "bar"]);
    await sleep(10);
    t.is(bNode.value.join(" "), "foo bar");
});
