import {solo, test} from "brittle";
import {sleep} from "../helpers/sleep.js";
import {createEventNode, createNode, dispatcher} from "../../lib/node/index.secure.js"; // Our new

test("createEventNode initializes with default value if provided", t => {
    const eventNode = createEventNode("hello", "default");
    t.is(eventNode.value, "default", "Event node should initialize with the provided default value");
});

test("createEventNode initializes with undefined if no default is provided", t => {
    const eventNode = createEventNode("hello");
    t.is(eventNode.value, undefined, "Event node should initialize as undefined when no default is provided");
});

test("createEventNode updates its value on global event emission", async t => {
    const eventNode = createEventNode("hello", "default");
    dispatcher.emit("hello", "payload1");
    await sleep(10);
    t.is(eventNode.value, "payload1", "Event node should update to the payload when the event is emitted");
});

test("createEventNode used in a computed node updates computed value accordingly", async t => {
    const x = createNode(10);
    // Create an event node that defaults to 0
    const eventNode = createEventNode("hello", 0);
    const computed = createNode(([x, y]) => x + y, [x, eventNode]);

    t.is(computed.value, 10, "Initially computed value is 10 (10 + 0)");

    dispatcher.emit("hello", 20);
    await sleep(10);
    t.is(computed.value, 30, "After emitting event with 20, computed value updates to 30 (10 + 20)");
});

test("createEventNode respects the context parameter", async t => {
    // Create two event nodes listening for the same event name,
    // but in different contexts.
    const nodeGlobal = createEventNode("hello", "default", "global");
    const nodeApp = createEventNode("hello", "default", "app");

    // Emit event in the global context.
    dispatcher.emit("hello", "globalPayload", "global");
    await sleep(10);
    t.is(nodeGlobal.value, "globalPayload", "Node in global context should update");
    t.is(nodeApp.value, "default", "Node in app context should not update from a global event");

    // Emit event in the app context.
    dispatcher.emit("hello", "appPayload", "app");
    await sleep(10);
    t.is(nodeApp.value, "appPayload", "Node in app context should update when event is emitted in app context");
});
