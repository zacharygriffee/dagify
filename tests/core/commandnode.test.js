import { test, solo } from "brittle";
import { CommandNode } from "../../lib/command-node/CommandNode.js"; // Adjust path as needed
import { sleep } from "../helpers/sleep.js";
import {createNode, dispatcher, NO_EMIT} from "../../lib/node/index.js";
import {createCommandNode} from "../../lib/command-node/index.js";

// Test: CommandNode processes valid synchronous data.
test("CommandNode processes valid synchronous data", (t) => {
    const handler = (data) => data.x + data.y;
    const cmd = new CommandNode("@test/command", handler);

    cmd.subscribe((val) => {
        t.is(val, 30, "Computed value should be the sum of x and y (10+20=30)");
    });

    cmd.set({ x: 10, y: 20 });
    cmd.complete();
});

// Test: CommandNode uses a validator to reject invalid data.
test("CommandNode rejects invalid data via validator", async (t) => {
    const validator = (data) => {
        if (typeof data.x !== "number" || typeof data.y !== "number") {
            return { valid: false, error: new Error("Invalid data") };
        }
        return { valid: true };
    };
    const handler = (data) => data.x + data.y;
    const cmd = new CommandNode("@test/command", handler, { validator });

    let errorMsg = "";
    cmd.subscribe({
        error: (err) => {
            errorMsg = err.message;
        },
    });

    cmd.set({ x: "bad", y: 20 });
    await sleep(20);
    t.is(errorMsg, "Invalid data", "Validator should reject non-numeric data");
    cmd.complete();
});

// Test: CommandNode applies a map to transform data.
test("CommandNode applies map to transform data", async (t) => {
    const map = (data) => ({ x: Math.round(data.x), y: Math.round(data.y) });
    const handler = (data) => data.x + data.y;
    const cmd = new CommandNode("@test/command", handler, { map });

    let result;
    cmd.subscribe((val) => {
        result = val;
    });

    cmd.set({ x: 10.4, y: 20.6 });
    await sleep(10);
    t.is(result, 31, "Filter should round values (10 + 21 = 31)");
    cmd.complete();
});

// Test: CommandNode handles an asynchronous handler.
test("CommandNode handles asynchronous handler", async (t) => {
    const handler = async (data) => {
        await sleep(10);
        return data.x * data.y;
    };
    const cmd = new CommandNode("@test/command", handler);

    let result;
    cmd.subscribe((val) => {
        result = val;
    });

    cmd.set({ x: 5, y: 4 });
    await sleep(50);
    t.is(result, 20, "Async handler should update state with result (5 * 4 = 20)");
    cmd.complete();
});

// Test: CommandNode next() works the same as set().
test("CommandNode next() delegates to set()", async (t) => {
    const handler = (data) => data.value * 2;
    const cmd = new CommandNode("@test/command", handler);

    let result;
    cmd.subscribe((val) => {
        result = val;
    });

    cmd.next({ value: 7 });
    await sleep(10);
    t.is(result, 14, "next() should process data and update state (7 * 2 = 14)");
    cmd.complete();
});

test("CommandNode use in computed", async (t) => {
    const handler = (data) => data.value * 2;
    const cmd = new CommandNode("@test/command", handler);
    const node = createNode(x => x * 2, cmd);

    cmd.next({value: 4});
    await sleep(0);
    t.is(node.value, 16);
    cmd.complete();
});

test("A command node that returns NO_EMIT should not trigger", async t => {
    const cmd = new CommandNode("@test/command", () => NO_EMIT);
    cmd.subscribe(val => {
        t.fail();
    })
    cmd.next("whatever");
    await sleep(100);
    cmd.complete();
});

test("A computed that has a dep of command node that returns NO_EMIT should not trigger", async t => {
    const cmd = new CommandNode("@test/command", () => NO_EMIT);
    createNode(x => {
        t.fail();
    }, cmd);
    cmd.next("whatever");
    await sleep(100);
    cmd.complete();
});


test("CommandNode does not emit when handler returns NO_EMIT", async t => {
    const handler = data => (data.skip ? NO_EMIT : data.value);
    const cmd = new CommandNode("@test/command", handler);
    let emissions = [];
    cmd.subscribe(val => emissions.push(val));
    cmd.set({ skip: true, value: 50 });
    await sleep(50);
    t.is(emissions.length, 0, "No emission when handler returns NO_EMIT");
    cmd.set({ skip: false, value: 50 });
    await sleep(50);
    t.is(cmd.value, 50, "CommandNode updates with valid command");
    t.is(emissions.length, 1, "One valid emission occurred");
    cmd.complete();
});

test("CommandNode with disableBatching", async t => {
    const cmd = new CommandNode("@test/command", a => t.ok(a === "hello" || a === "world"), {disableBatching: true});

    cmd.set("hello");
    cmd.set("world");
    cmd.unsubscribe();
});

test("CommandNode with disableBatching through computed", async t => {
    const results = ["hello", "world"];
    const cmd = new CommandNode("@test/command", a => a, {disableBatching: true});

    const comp = createNode(a => t.is(a, results.shift()), cmd, {disableBatching: true});

    cmd.set("hello");
    cmd.set("world");

    cmd.unsubscribe();
    comp.unsubscribe();
});

solo("CommandNode with disableBatching through computed via event", async t => {
    const results = ["hello", "world"];
    const cmd = createCommandNode("@test/command", a => a, { disableBatching: true });
    const comp = createNode(a => t.is(a, results.shift()), cmd, { disableBatching: true });

    dispatcher.emit("@test/command", "hello");
    dispatcher.emit("@test/command", "world");

    cmd.unsubscribe();
    comp.unsubscribe();
});