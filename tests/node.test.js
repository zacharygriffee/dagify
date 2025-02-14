import {solo, test} from "brittle";
import {batch, createComposite, createNode} from "../index.js";
import {concat, delay, firstValueFrom, from, interval, map, of, startWith, take, tap, toArray, zip, zipAll} from "rxjs";
import {takeUntilCompleted} from "../lib/util/takeUntilCompleted.js";
import {nodeFactory} from "../lib/nodeFactory.js";
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

    const unsub = node.skip.subscribe((a) => {
        t.fail("Subscriber should not be called after unsubscribe");
    });

    unsub.unsubscribe();
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

test("Node factory object", async t => {
    const {node1, node2} = nodeFactory(5);
    t.is(node1.value, 5);
    t.is(node1.value, node2.value);
    const nodes = nodeFactory(6);

    nodes.x.set(5);
    nodes.y.set(1);
    nodes.z.set(1001);
    nodes.w;

    nodes.x.once.subscribe(x => t.is(x, 5));

    const test = createComposite(nodes);
    const comp = createNode(([{x, y, z, w}]) => `${x} ${y} ${z} ${w}`, [test]);

    t.is(comp.value, "5 1 1001 6");

    nodes.clear();
    comp.complete();
    test.complete();
});

test("Node factory array", async t => {
    const [x,y,z] = nodeFactory("hello");
    y.set("world");
    z.next("!!!");

    const value = await firstValueFrom(concat(x.once, y.once, z.once).pipe(take(3), toArray(), map(x => {
        console.log(x);
        return x.join(" ");
    })));

    t.is(value, "hello world !!!");
});

test("Object node", async t => {
    const objState = createNode({color: "red", size: 10});
    const color = createNode(([{color}]) => color, [objState]);
    const size = createNode(([{size}]) => size, [objState]);
    await sleep(1);
    t.is(color.value, "red");
    t.is(size.value, 10);
});

test("Return a node from computed node", async t => {
    const node = createNode(5);
    const computed = createNode(([a]) => node, [node]);
    t.is(computed.value, 5);
    node.set(10);
    await sleep(50);
    t.is(computed.value, 10);
});

test("pass a node as static", async t => {
    const node1 = createNode(10);
    const node2 = createNode(node1);
    const node3 = createNode((x) => x, node2);
    t.is(node3.value, 10);
    t.is(node2.value.value, 10);
    node1.set(20);
    await sleep(50);
    t.is(node2.value.value, 20);
    t.is(node3.value, 20);
});

test("Pass a function as a dependency", async t => {
    const x = createNode(([y]) => y + 2, [() => 3]);
    t.is(x.value, 5)
});

test("Pass an async function as a dependnency", async t => {
    const x = createNode(([y]) => y ? y + 2 : 0, [async () => 3]);
    t.is(x.value, 0);
    await sleep(0);
    t.is(x.value, 5);
});

test("Pass a function with side effect values", async t => {
    t.plan(1);
    let n = 0;
    const getter = () => n;

    const x = createNode(([y]) => {
        return y * 2 || 50;
    }, [getter]);
    const values = [];
    x.subscribe(
        {
            next: o => {
                values.push(o);
                if (values.length === 4) {
                    clearInterval(timer);
                    x.complete();
                }
            },
            complete: () => {
                t.alike([50, 2, 4, 6], values, "Values emitted are correct");
            }
        }
    );

    const timer = setInterval(() => {
        x.update();
        return n++;
    }, 100);
});

test("Synchronous function dependency re-computes correctly", async t => {
    let counter = 10;
    const getter = () => counter;
    const node = createNode(([v]) => v + 1, [getter]);

    t.is(node.value, 11, "Initial value is 11");

    counter = 20;
    node.update();
    t.is(node.value, 21, "Value updates to 21 after changing counter");
});

test("Async function dependency re-computes correctly", async t => {
    let num = 5;
    const getter = async () => {
        await new Promise(r => setTimeout(r, 10));
        return num;
    };

    const node = createNode(([v]) => v * 3, [getter]);

    // Wait a little for the async dependency to resolve.
    await sleep(20);
    t.is(node.value, 15, "Value is 15 after async dependency resolves");

    num = 7;
    node.update();
    await sleep(20);
    t.is(node.value, 21, "Value updates to 21 after async dependency changes");
});

test("Remove dependency in positional mode", async t => {
    let a = 2, b = 3;
    const dep1 = () => a;
    const dep2 = () => b;
    const node = createNode(([x, y = 0]) => x + y, [dep1, dep2]);

    t.is(node.value, 5, "Initial sum is 5");

    // Remove dep2 and expect only dep1's value to be used.
    node.removeDependency(dep2);
    node.update();
    await sleep(10);
    t.is(node.value, 2, "After removal, value is 2");
});

test("Remove dependency in named mode", async t => {
    let a = 10, b = 20;
    const node = createNode(
        ({ a, b }) => (a || 0) + (b || 0),
        { a: () => a, b: () => b }
    );

    await new Promise(r => setTimeout(r, 10));
    t.is(node.value, 30, "Initial sum is 30");

    // Remove dependency by key
    node.removeDependency("b");
    node.update();
    await new Promise(r => setTimeout(r, 10));
    t.is(node.value, 10, "After removal of b, value is 10");
});

test("Force update on stateful node re-emits same value", async t => {
    const state = createNode(100);
    let emissions = [];
    state.subscribe(v => emissions.push(v));

    // Calling set(100) or update() on a stateful node that doesn't change value normally wouldn't re-emit.
    state.update();
    await sleep();
    t.is(emissions.length, 2, "update() forces a re-emission even if value is unchanged");
});

test("update() on stateful node works with both function and direct value", async t => {
    const state = createNode(50);
    let emitted;
    state.subscribe(v => emitted = v);

    // Update with a function: increment by 10.
    state.update(val => val + 10);
    await sleep();
    t.is(emitted, 60, "Value becomes 60 after function update");

    // Update with a direct value.
    state.update(100);
    await sleep();
    t.is(emitted, 100, "Value becomes 100 after direct update");

    // Force re-emit current value.
    state.update();
    await sleep();
    t.is(emitted, 100, "Re-emission returns the same value");
});


test("computed node in object mode", async t => {
    // Create individual stateful nodes.
    const a = createNode(10);
    const b = createNode(20);
    const c = createNode(30);

    // Create a computed node with named dependencies (object mode).
    const computed = createNode(
        ({ a, b, c }) => a + b + c,
        { a, b, c }
    );
    await sleep();
    // Initially, computed.value should equal 10 + 20 + 30 = 60.
    t.is(computed.value, 60, "Initial computed value is 60");

    // Update node 'a' to 40: 40 + 20 + 30 = 90.
    a.set(40);
    await sleep();
    t.is(computed.value, 90, "After updating a, computed value is 90");

    // Update node 'b' to 50: 40 + 50 + 30 = 120.
    b.set(50);
    await sleep();
    t.is(computed.value, 120, "After updating b, computed value is 120");
});

test("computed node with object nested in array", async t => {
    // Create two stateful nodes.
    const a = createNode(3);
    const b = createNode(4);

    // Create a computed node where the dependency is an array containing an object.
    // The computed function receives a single array whose first element is the object.
    const computed = createNode(
        ([{ a, b }]) => a * b, // Multiply a and b.
        [{ a, b }]
    );

    await sleep();
    // Initially, computed.value should equal 3 * 4 = 12.
    t.is(computed.value, 12, "Initial computed value is 12");

    // Update node 'a' to 5: 5 * 4 = 20.
    a.set(5);
    await sleep();
    t.is(computed.value, 20, "After updating a, computed value is 20");

    // Update node 'b' to 6: 5 * 6 = 30.
    b.set(6);
    await sleep();
    t.is(computed.value, 30, "After updating b, computed value is 30");
});

test('Positional mode: add and remove dependency (single value and multiple values)', t => {
    // Create two stateful nodes.
    const a = createNode(1)
    const b = createNode(2)
    const c = createNode(3)
    const d = createNode(4)

    // Create a computed node with an initial dependency [a].
    // The computed function sums all dependency values (spread into arguments).
    const computed = createNode((...values) => values.reduce((sum, x) => sum + x, 0), [a])
    t.is(computed.value, 1, 'Initial computed value equals 1 (only a)')

    // Add dependency: add single node (b) by reference.
    computed.addDependency(b)
    // Now dependencies are [a, b] => 1 + 2 = 3.
    t.is(computed.value, 3, 'After adding b, computed value equals 3')

    // Add multiple dependencies at once.
    computed.addDependency(c, d)
    // Now dependencies are [a, b, c, d] => 1 + 2 + 3 + 4 = 10.
    t.is(computed.value, 10, 'After adding c and d, computed value equals 10')

    // Remove a dependency (b).
    computed.removeDependency(b)
    // Now dependencies are [a, c, d] => 1 + 3 + 4 = 8.
    t.is(computed.value, 8, 'After removing b, computed value equals 8')

    // Remove multiple dependencies at once using an array.
    computed.removeDependency([c, d])
    // Now dependencies are [a] => 1.
    t.is(computed.value, 1, 'After removing c and d, computed value equals 1')
})

// --- Named (object) mode tests ---

test('Named mode: add and remove dependency (using key/value and node reference)', async t => {
    // Create three stateful nodes.
    const a = createNode(10)
    const b = createNode(20)
    const c = createNode(30)

    // Create a computed node with initial dependency as an object.
    // The computed function sums properties "a", "b", and "c".
    // Initially, only "a" is present.
    const computed = createNode(
        ({ a, b, c }) => (a || 0) + (b || 0) + (c || 0),
        { a }
    )
    t.is(computed.value, 10, 'Initial computed value equals 10 (only a)')

    // Add dependency by explicit key.
    computed.addDependency('b', b)
    // Now dependency object is { a, b } => 10 + 20 = 30.
    t.is(computed.value, 30, 'After adding key "b", computed value equals 30')

    // Add dependency by passing an object.
    computed.addDependency({ c })
    // Now dependency object is { a, b, c } => 10 + 20 + 30 = 60.
    t.is(computed.value, 60, 'After adding c via object, computed value equals 60')

    // Remove dependency by key.
    computed.removeDependency('b')
    // Now dependency object is { a, c } => 10 + 30 = 40.
    t.is(computed.value, 40, 'After removing dependency "b", computed value equals 40')

    // Remove dependency by node reference.
    computed.removeDependency(c)
    // Now dependency object should only have { a } => 10.
    t.is(computed.value, 10, 'After removing dependency c by reference, computed value equals 10')

    // Also test removal using a plain object (remove by keys).
    // First, add b back using its key explicitly.
    computed.addDependency('b', b)
    await sleep(0)
    t.is(computed.value, 30, 'After re-adding b with key "b", computed value equals 30')
    computed.removeDependency(b)
    await sleep(0)
    t.is(computed.value, 10, 'After removing dependency with object { b: true }, computed value equals 10')
})