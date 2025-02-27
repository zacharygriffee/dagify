import {solo, test} from "brittle";
import {ShallowReactiveNode} from "../../lib/shallow-node/ShallowReactiveNode.js";
import {sleep} from "../helpers/sleep.js";
import {createNode} from "../../lib/node/index.js"; // adjust the import path as needed

test("ShallowReactiveNode should initialize with a value", (t) => {
    const node = new ShallowReactiveNode(10);
    t.is(node.value, 10, "Node should initialize with the given value");
});

test("ShallowReactiveNode should allow value updates", (t) => {
    const node = new ShallowReactiveNode(0);
    node.set(42);
    t.is(node.value, 42, "Node should update when set() is called");
});

test("ShallowReactiveNode triggers subscription when shallow value changes", async (t) => {
    t.plan(2);
    // Create an object whose inner value is an object.
    const initialObj = { a: { b: 1 } };
    const node = new ShallowReactiveNode(initialObj);
    let callCount = 0;

    node.subscribe(val => {
        if (callCount === 0) {
            t.alike(val, initialObj, "Initial value emitted");
        } else if (callCount === 1) {
            t.alike(val, { a: { b: 1 } }, "New object (deeply equal but with a new inner reference) triggers update");
        }
        callCount++;
    });

    // Create a new object that is deep equal to the first one but whose inner object is a new instance.
    const newObj = { a: { b: 1 } };
    // Although deepEqual(initialObj, newObj) would be true,
    // our shallow comparison will notice that initialObj.a !== newObj.a.
    node.set(newObj);
});

test("ShallowReactiveNode does not emit update when the same reference is set", async (t) => {
    t.plan(1);
    const value = { a: 1 };
    const node = new ShallowReactiveNode(value);
    let callCount = 0;

    node.subscribe(() => {
        callCount++;
    });

    // Setting the same object reference should not trigger an update.
    node.set(value);
    await sleep(50);
    t.is(callCount, 1, "No additional emission if the same reference is set");
});

test("ShallowReactiveNode computed node updates on dependency change", async (t) => {
    t.plan(2);
    const a = new ShallowReactiveNode(2);
    const b = new ShallowReactiveNode(3);
    // Create a computed node using shallow nodes as dependencies.
    const sum = new ShallowReactiveNode(([a, b]) => a + b, [a, b]);

    t.is(sum.value, 5, "Initial computed value is correct");

    let callCount = 0;
    sum.subscribe(val => {
        if (callCount === 1) {
            t.is(val, 10, "Computed node updates when dependency changes");
        }
        callCount++;
    });

    // Update one dependency. Even though we use primitive numbers,
    // the change should be detected and the computed node should update.
    a.set(7); // 7 + 3 = 10
});

solo("Create a shallow reactive node from createNode", t => {
    const node = createNode(42, {shallow: true});
    t.ok(node instanceof ShallowReactiveNode);
})