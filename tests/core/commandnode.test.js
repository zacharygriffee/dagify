import { test, solo } from "brittle";
import { CommandNode } from "../../lib/node/CommandNode.js"; // Adjust path as needed
import { sleep } from "../helpers/sleep.js";
import {createNode} from "../../lib/node/entry.js";

// Test: CommandNode processes valid synchronous data.
test("CommandNode processes valid synchronous data", (t) => {
    const handler = (data) => data.x + data.y;
    const cmd = new CommandNode("@test/command", handler);

    cmd.subscribe((val) => {
        t.is(val, 30, "Computed value should be the sum of x and y (10+20=30)");
    });

    cmd.set({ x: 10, y: 20 });
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
});

test("CommandNode use in computed", async (t) => {
    const handler = (data) => data.value * 2;
    const cmd = new CommandNode("@test/command", handler);
    const node = createNode(x => x * 2, cmd);

    cmd.next({value: 4});
    await sleep(0);
    t.is(node.value, 16);
});