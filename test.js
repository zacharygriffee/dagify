import { test, solo } from "brittle";
import { createNode, batch } from "./index.js";

// Helper: delay function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("createNode should initialize with a value", (t) => {
    const node = createNode(10);
    t.is(node.value, 10, "Node should initialize with the given value");
});

test("createNode should allow value updates", (t) => {
    const node = createNode(0);
    node.set(42);
    t.is(node.value, 42, "Node should update when set() is called");
});

test("createNode should trigger subscriptions on value change", async (t) => {
    t.plan(2);
    const node = createNode(5);

    let callCount = 0;

    node.subscribe((val) => {
        if (callCount === 0) {
            t.is(val, 5, "First emitted value should be initial state");
        } else if (callCount === 1) {
            t.is(val, 10, "Subscription should receive updated value");
        }
        callCount++;
    });

    node.set(10);
});

test("createNode should trigger subscriptions on value change with skip", async (t) => {
    t.plan(1);
    const node = createNode(5);

    node.skip.subscribe((val) => t.is(val, 10, "Subscription should receive updated value"));

    node.set(10);
});


test("computedNode should initialize with correct computed value", (t) => {
    const a = createNode(2);
    const b = createNode(3);
    const sum = createNode(([a, b]) => a + b, [a, b]);

    t.is(sum.value, 5, "Computed node should initialize correctly");
});

test("computedNode should update when dependencies change", (t) => {
    t.plan(2);
    const a = createNode(2);
    const b = createNode(3);
    const sum = createNode(([a, b]) => a + b, [a, b]);

    let callCount = 0;

    sum.subscribe((val) => {
        if (callCount === 0) {
            t.is(val, 5, "First computed value should be initial state");
        } else if (callCount === 1) {
            t.is(val, 10, "Computed node should update on dependency change");
        }
        callCount++;
    });

    a.set(7); // Triggers recomputation
});




test("computedNode should not allow manual set()", (t) => {
    const a = createNode(2);
    const double = createNode(([a]) => a * 2, [a]);

    t.exception(() => double.set(10), "Computed nodes should not allow manual set()");
});

test("createNode should unsubscribe correctly", (t) => {
    t.plan(1);
    const node = createNode(0);

    const unsubscribe = node.subscribe(() => {
        t.fail("Subscriber should not be called after unsubscribe");
    });

    unsubscribe();
    node.set(100);

    t.pass("Unsubscription should prevent further calls");
});


test("node.skip.subscribe should not emit initial value", async (t) => {
    t.plan(1);
    const node = createNode(5);
    let callCount = 0;
    node.skip.subscribe((val) => {
        callCount++;
        if (callCount === 1) {
            t.is(val, 10, "Skip subscription should only receive updated value");
        } else {
            t.fail("Subscriber should not be called more than once");
        }
    });
    node.set(10);
    await new Promise(resolve => setTimeout(resolve, 100));
});

test("set with same value should not trigger duplicate notification", async (t) => {
    t.plan(1);
    const node = createNode(5);
    let callCount = 0;
    node.subscribe(() => {
        callCount++;
    });
    // The initial subscription will emit 5.
    node.set(5); // Setting same value should not trigger a new notification.
    await new Promise(resolve => setTimeout(resolve, 100));
    // Expect only the initial emission.
    t.is(callCount, 1, "No additional emission should occur if the value does not change");
});

test("batch mode should deliver only final update", async (t) => {
    t.plan(1);
    const node = createNode(0);
    let lastVal = null;
    node.subscribe((val) => {
        lastVal = val;
    });
    batch(() => {
        node.set(1);
        node.set(2);
        node.set(3);
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    t.is(lastVal, 3, "The subscriber should only see the final value from batched updates");
});

test("multiple subscribers should receive notifications", async (t) => {
    t.plan(2);
    const node = createNode(0);
    let sub1Called = false;
    let sub2Called = false;
    node.subscribe((val) => {
        if (val === 10) sub1Called = true;
    });
    node.subscribe((val) => {
        if (val === 10) sub2Called = true;
    });
    node.set(10);
    await new Promise(resolve => setTimeout(resolve, 100));
    t.ok(sub1Called, "Subscriber 1 should receive the update");
    t.ok(sub2Called, "Subscriber 2 should receive the update");
});


test("next() should behave like set() for non-computed node", async (t) => {
    t.plan(1);
    const node = createNode(0);
    node.skip.subscribe((val) => {
        t.is(val, 20, "next() should update the node value like set()");
    });
    node.next(20);
});

/* === Error Handling Tests === */

// 1. Computed node error propagation via a throwing function.
// Note: With the updated implementation, a subscriber should receive only an error,
// not an initial "next" emission.
test("computed node should notify error callback when computation throws", async (t) => {
    t.plan(1);
    const source = createNode(5);
    const faulty = createNode(([a]) => {
        throw new Error("test error");
    }, [source]);

    faulty.subscribe({
        next: () => t.fail("Should not receive a next value"),
        error: (err) => t.is(err.message, "test error", "Error callback triggered with proper message")
    });

    // Trigger recomputation by updating the dependency.
    source.set(6);
    await delay(50);
});


// 2. Direct call to error() should notify subscribers.
test("node.error should trigger error callbacks", async (t) => {
    t.plan(1);
    const node = createNode(10);
    node.subscribe({
        next: () => t.fail("Should not receive next value"),
        error: (err) => t.is(err.message, "explicit error", "Direct error call notifies subscribers")
    });
    node.error(new Error("explicit error"));
    await delay(50);
});

/* === Completion Tests === */

test("complete() should notify subscribers and prevent further updates", async (t) => {
    t.plan(3);
    const node = createNode(100);
    let completeCalled = false;
    let updateCalled = false;

    node.subscribe({
        next: (val) => { updateCalled = true; },
        complete: () => { completeCalled = true; t.pass("Complete callback called"); }
    });

    node.complete();
    // Attempt to update after completion.
    node.set(200);
    await delay(50);

    t.ok(completeCalled, "Complete was called");
    t.absent(updateCalled, "No update after completion");
});

test("subscribing to a completed node should immediately trigger complete", async (t) => {
    t.plan(1);
    const node = createNode(50);
    node.complete();

    node.subscribe({
        next: () => t.fail("No value should be emitted"),
        complete: () => t.pass("Complete immediately notified")
    });
    await delay(50);
});

/* === Subscribe Once Tests === */

test("subscribeOnce should only trigger a single emission", async (t) => {
    t.plan(1);
    const node = createNode(0);
    let callCount = 0;

    node.subscribeOnce((val) => {
        callCount++;
    });

    node.set(1);
    node.set(2);
    await delay(50);
    t.is(callCount, 1, "subscribeOnce only triggered once");
});

/* === Dependency Cleanup Tests for Computed Nodes === */

test("computed node should cleanup dependency subscriptions when no subscribers remain", async (t) => {
    t.plan(2);
    const dep = createNode(1);
    const computed = createNode(([a]) => a * 2, [dep]);

    // Subscribe and then immediately unsubscribe.
    const unsub = computed.subscribe(() => {});
    unsub();
    await delay(50);
    t.is(computed.subscribers.size, 0, "All subscribers removed");
    t.ok(!computed._dependencySubscriptions || computed._dependencySubscriptions.length === 0, "Dependency subscriptions cleaned up");
});

test("new subscription to computed node reinitializes dependency subscriptions", async (t) => {
    t.plan(3);
    const dep = createNode(2);
    const computed = createNode(([a]) => a + 1, [dep]);

    // Subscribe then unsubscribe to clean up dependencies.
    let unsub = computed.subscribe(() => {});
    unsub();
    await delay(50);

    t.ok(!computed._dependencySubscriptions || computed._dependencySubscriptions.length === 0, "Dependency subscriptions cleaned up");

    // Add a new subscriber.
    computed.subscribe((v) => t.is(v, 3, "New subscriber receives computed value"));
    t.ok(computed._dependencySubscriptions && computed._dependencySubscriptions.length > 0, "Dependency subscriptions reinitialized");
    // Do not change the dependency value, so the new subscriber immediately gets the current value 3.
    await delay(50);
});

test("new subscription receives immediate value and then update", async (t) => {
    t.plan(2);
    const dep = createNode(2);
    const computed = createNode(([a]) => a + 1, [dep]);

    const values = [];
    computed.subscribe((v) => values.push(v));
    // Immediately, the subscriber should receive 3.
    await delay(50);
    t.alike(values, [3], "Immediate emission is 3");

    // Update dependency: now computed should become 4.
    dep.set(3);
    await delay(50);
    t.alike(values, [3, 4], "After update, emissions are [3, 4]");
});


/* === Skip Subscription Tests === */

test("skip subscription should not emit the initial value", async (t) => {
    t.plan(3);
    const node = createNode(10);
    let called = false;

    node.skip.subscribe((val) => {
        t.is(val, 20, "Skip subscription receives updated value only");
        called = true;
    });

    // Wait a bit to ensure no initial emission is delivered.
    await delay(50);
    t.absent(called, "No emission on subscription");

    node.set(20);
    await delay(50);
    t.ok(called, "Skip subscription received update after value change");
});
