import {solo, test} from "brittle";
import {batch, createNode} from "../index.js";
import {concatMap, delay, interval, of, startWith, take, tap} from "rxjs";
import {takeUntilCompleted} from "../lib/util/takeUntilCompleted.js";
// Helper: sleep function
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

    const unsubscribe = node.skip.subscribe((a) => {
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
        next: (x) => t.fail("Should not receive a next value"),
        error: (err) => t.is(err.message, "test error", "Error callback triggered with proper message")
    });

    // Trigger recomputation by updating the dependency.
    source.set(6);
    await sleep(50);
});


// 2. Direct call to error() should notify subscribers.
test("node.error should trigger error callbacks", async (t) => {
    t.plan(1);
    const node = createNode(10);
    node.skip.subscribe({
        next: (x) => t.fail("Should not receive next value"),
        error: (err) => t.is(err.message, "explicit error", "Direct error call notifies subscribers")
    });
    node.error(new Error("explicit error"));
    await sleep(50);
});

/* === Completion Tests === */

test("complete() should notify subscribers and prevent further updates", async (t) => {
    t.plan(3);
    const node = createNode(100);
    let completeCalled = false;
    let updateCalled = false;

    node.skip.subscribe({
        next: (val) => updateCalled = true,
        complete: () => { completeCalled = true; t.pass("Complete callback called"); }
    });

    node.complete();
    // Attempt to update after completion.
    node.set(200);
    await sleep(50);

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
    await sleep(50);
});

/* === Subscribe Once Tests === */

test("subscribeOnce should only trigger a single emission", async (t) => {
    t.plan(1);
    const node = createNode(0);
    let callCount = 0;

    node.once.subscribe((val) => {
        callCount++;
    });

    node.set(1);
    node.set(2);
    await sleep(50);
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
    await sleep(50);
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
    await sleep(50);

    t.ok(!computed._dependencySubscriptions || computed._dependencySubscriptions.length === 0, "Dependency subscriptions cleaned up");

    // Add a new subscriber.
    computed.subscribe((v) => t.is(v, 3, "New subscriber receives computed value"));
    t.ok(computed._dependencySubscriptions && computed._dependencySubscriptions.length > 0, "Dependency subscriptions reinitialized");
    // Do not change the dependency value, so the new subscriber immediately gets the current value 3.
    await sleep(50);
});

test("new subscription receives immediate value and then update", async (t) => {
    t.plan(2);
    const dep = createNode(2);
    const computed = createNode(([a]) => a + 1, [dep]);

    const values = [];
    computed.subscribe((v) => values.push(v));
    // Immediately, the subscriber should receive 3.
    await sleep(50);
    t.alike(values, [3], "Immediate emission is 3");

    // Update dependency: now computed should become 4.
    dep.set(3);
    await sleep(50);
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
    await sleep(50);
    t.absent(called, "No emission on subscription");

    node.set(20);
    await sleep(50);
    t.ok(called, "Skip subscription received update after value change");
});


test("use an rxjs observable as a dependency", async t => {
    // Create a constant node.
    let finalized = false;
    const x = createNode(10);
    const y = createNode(([x, intervalNode]) =>  x + intervalNode, [x, interval(50).pipe(startWith(0), takeUntilCompleted(x), tap({complete: () => finalized = true}))]);

    // Wait 1000ms so that the interval has time to emit several values.
    await sleep(500);

    t.is(y.value, 18, "y should be 18");

    x.complete();
    y.complete();
    await sleep();
    t.ok(finalized, "Finalization of interval happened");
});

test("a dagify node can be passed an observable...", async t => {
    t.plan(5);
    const x = createNode(interval(10).pipe(take(5), startWith(0)));
    let i = 0;
    x.subscribe(o => {
        t.is(o, i++);
    });
});

/* === Async Computed Node Tests === */

// Test that a computed node returning a Promise updates its value asynchronously.
test("computed node handles promise async computation", async (t) => {
    t.plan(2);
    const dep = createNode(5);
    const asyncPromiseNode = createNode(([a]) => {
        // Return a promise that resolves after 50ms.
        return new Promise((resolve) => {
            setTimeout(() => resolve(a * 2), 50);
        });
    }, [dep]);

    // Immediately after compute(), the node should be marked as async.
    t.ok(asyncPromiseNode.isAsync, "Computed node should be marked async when using a promise");

    // Wait enough time for the promise to resolve.
    await sleep(100);
    t.is(asyncPromiseNode.value, 10, "Computed node should update its value from the promise");
});

// Test that a computed node returning an Observable updates its value asynchronously.
test("computed node handles observable async computation", async (t) => {
    t.plan(2);
    const dep = createNode(4);
    const asyncObservableNode = createNode(([a]) => {
        // Return an observable that emits a value after a sleep.
        return of(a + 3).pipe(delay(50));
    }, [dep]);

    // Immediately after compute(), the node should be marked as async.
    t.ok(asyncObservableNode.isAsync, "Computed node should be marked async when using an observable");

    // Wait enough time for the observable to emit.
    await sleep(100);
    t.is(asyncObservableNode.value, 7, "Computed node should update its value from the observable");
});

// Test that a computed node returning a plain (synchronous) value is not marked async.
test("computed node remains sync when returning a plain value", async (t) => {
    t.plan(2);
    const dep = createNode(10);
    const syncComputed = createNode(([a]) => a + 1, [dep]);

    // Wait briefly to let any asynchronous processes (if any) settle.
    await sleep(50);
    t.absent(syncComputed.isAsync, "Computed node should not be marked async when returning a plain value");
    t.is(syncComputed.value, 11, "Computed node computes synchronously as expected");
});

test("ReactiveNode should not drop intermediate updates", async (t) => {
    t.plan(1);

    const node = createNode(0);
    const observedValues = [];

    node.subscribe((val) => {
        observedValues.push(val);
    });

    // Apply rapid updates
    node.set(1);
    node.set(2);
    node.set(3);
    node.set(4);
    node.set(5);

    // Allow time for updates to process
    await sleep();

    t.alike(observedValues, [0, 1, 2, 3, 4, 5], "All updates should be emitted in order");
});


/* === Nested Object/Array Update Tests === */

// Test that updating a node holding a nested object with a deeply equal object
// does not trigger a new update, but changing a nested value does.
test("node should trigger update when nested object changes", async (t) => {
    t.plan(2);
    const initialObj = { a: { b: 1 } };
    const node = createNode(initialObj);
    let callCount = 0;

    node.subscribe((val) => {
        callCount++;
        if (callCount === 1) {
            t.alike(val, initialObj, "Initial value matches");
        } else if (callCount === 2) {
            t.alike(val, { a: { b: 2 } }, "Nested object update triggers new emission");
        }
    });

    // Update with a deeply equal object: should NOT trigger a new emission.
    node.set({ a: { b: 1 } });
    await sleep(50);

    // Update with a new object that differs in its nested value: should trigger an update.
    node.set({ a: { b: 2 } });
});

// Test that updating a node holding a nested array with a deeply equal array
// does not trigger a new update, but changing a nested element does.
test("node should trigger update when nested array changes", async (t) => {
    t.plan(2);
    const initialArr = [1, [2, 3]];
    const node = createNode(initialArr);
    let callCount = 0;

    node.subscribe((val) => {
        callCount++;
        if (callCount === 1) {
            t.alike(val, initialArr, "Initial array value matches");
        } else if (callCount === 2) {
            t.alike(val, [1, [2, 4]], "Nested array update triggers new emission");
        }
    });

    // Update with a deeply equal array: should NOT trigger a new emission.
    node.set([1, [2, 3]]);
    await sleep(50);

    // Update with a new array that differs in its nested value: should trigger an update.
    node.set([1, [2, 4]]);
});

// Test that a computed node that always returns a new object which is deep equal to
// the previous result does not trigger a duplicate emission.
test("computed node should not emit update if computed value is deeply equal", async (t) => {
    t.plan(1);
    const a = createNode({ x: 1 });
    const computed = createNode(([obj]) => {
        // Always returns a new object, even though its content is identical.
        return { x: obj.x };
    }, [a]);

    let callCount = 0;
    computed.subscribe(() => {
        callCount++;
    });

    // Update dependency with an object that is deeply equal to the previous value.
    a.set({ x: 1 });
    await sleep(50);

    t.is(callCount, 1, "No update should be emitted if computed result is deeply equal");
});

