import {test, skip, solo} from "brittle";
import {createComposite} from "../../lib/composite/index.js";
import {batch, createNode, nodeFactory} from "../../lib/node/index.js";
import {ReactiveNode} from "../../lib/node/ReactiveNode.js";
import {concat, delay, firstValueFrom, map, of, Subject, take, toArray} from "rxjs";
import {sleep} from "../helpers/sleep.js";
import b4a from "b4a";
import {NO_EMIT} from "../../lib/node/NO_EMIT.js";

/* --------------------------------------------------------------------------
   Helpers
-------------------------------------------------------------------------- */

// A helper to test a node’s subscription response: it expects an initial emission
// and then an update when a new value is set.
async function verifySubscription(t, node, updateFn, { initial, updated, callsExpected = 2 }) {
    let callCount = 0;
    node.subscribe((val) => {
        if (callCount === 0) t.is(val, initial, "Initial emission is correct");
        else if (callCount === 1) t.is(val, updated, "Updated emission is correct");
        callCount++;
    });
    updateFn();
    await sleep(50);
    t.is(callCount, callsExpected, "Correct number of emissions");
}

// A helper to verify that a computed node does not update if the computed value
// remains deeply equal.
async function verifyNoRedundantEmission(t, node, dep, updateVal) {
    let callCount = 0;
    node.subscribe(() => callCount++);
    dep.set(updateVal);
    await sleep(50);
    t.is(callCount, 1, "No extra emission when value is deeply equal");
}

/* --------------------------------------------------------------------------
   Basic Node Tests
-------------------------------------------------------------------------- */

test("each node creates a 32 byte unique identifier", t => {
    const node1 = createNode(NO_EMIT);
    const node2 = createNode(NO_EMIT);
    t.is(node1.key.byteLength, 32);
    t.is(node2.key.byteLength, 32);
    t.absent(b4a.equals(node1.key, node2.key));
});

test("createNode initializes with a value and allows updates", t => {
    const node = createNode(10);
    t.is(node.value, 10, "Node initializes with given value");
    node.set(42);
    t.is(node.value, 42, "Node updates when set() is called");
});

test("next() works like set() for non-computed node", async t => {
    const node = createNode();
    node.subscribe(val => t.is(val, 20, "next() updates the node value"));
    node.next(20);
});

/* --------------------------------------------------------------------------
   Subscription Tests
-------------------------------------------------------------------------- */

// Test that subscribers receive the initial value and then updated value.
test("node subscriptions trigger on value change", async t => {
    const node = createNode(5);
    await verifySubscription(t, node, () => node.set(10), { initial: 5, updated: 10 });
});

// Test that the skip subscription does not emit the initial value.
test("skip subscription emits only updated values", async t => {
    const node = createNode(5);
    let callCount = 0;
    node.skip.subscribe(val => {
        callCount++;
        t.is(val, 10, "Skip subscription receives updated value");
    });
    // No emission should occur immediately.
    await sleep(50);
    t.absent(callCount, "No emission on subscription");
    node.set(10);
    await sleep(50);
    t.is(callCount, 1, "Skip subscription received update");
});

// Test unsubscription works correctly.
test("createNode unsubscribes correctly", async t => {
    t.plan(1);
    const node = createNode();
    const unsub = node.subscribe(() => t.fail("Should not be called after unsubscribe"));
    unsub.unsubscribe();
    node.set(100);
    t.pass("Unsubscription prevents further calls");
});

// Test that setting the same value does not trigger duplicate notifications.
test("setting same value does not trigger duplicate notification", async t => {
    t.plan(1);
    const node = createNode(5);
    let callCount = 0;
    node.subscribe(() => callCount++);
    node.set(5); // No change.
    await sleep(50);
    t.is(callCount, 1, "Only initial emission occurred");
});

/* --------------------------------------------------------------------------
   Computed Node Tests
-------------------------------------------------------------------------- */

test("computedNode initializes with computed value", t => {
    const a = createNode(2);
    const b = createNode(3);
    const sum = createNode(([a, b]) => a + b, [a, b]);
    t.is(sum.value, 5, "Computed node initialized correctly");
});

test("computedNode updates when dependencies change", async t => {
    t.plan(2);
    const a = createNode(2);
    const b = createNode(3);
    const sum = createNode(([a, b]) => a + b, [a, b]);
    let callCount = 0;
    sum.subscribe(val => {
        if (callCount === 0) t.is(val, 5, "Initial computed value");
        else if (callCount === 1) t.is(val, 10, "Computed node updates on dependency change");
        callCount++;
    });
    a.set(7);
});

test("computedNode does not allow manual set()", t => {
    const a = createNode(2);
    const double = createNode(([a]) => a * 2, [a]);
    t.exception(() => double.set(10), "Manual set() is not allowed on computed nodes");
});

test("computed node does not emit duplicate updates for deep equality", async t => {
    t.plan(1);
    const a = createNode({ x: 1 });
    const computed = createNode(([obj]) => ({ x: obj.x }), [a]);
    let callCount = 0;
    computed.subscribe(() => callCount++);
    a.set({ x: 1 });
    await sleep(50);
    t.is(callCount, 1, "No redundant emission when computed result is deeply equal");
});

/* --------------------------------------------------------------------------
   Batched Updates Tests
-------------------------------------------------------------------------- */

test("batch mode delivers only final update", async t => {
    t.plan(1);
    const node = createNode(0);
    let lastVal = null;
    node.subscribe(val => lastVal = val);
    batch(() => {
        node.set(1);
        node.set(2);
        node.set(3);
    });
    await sleep(100);
    t.is(lastVal, 3, "Subscriber sees only the final value from batch");
});

test("batch flushes pending updates and resets state after error", async t => {
    const source = createNode(0, null, { disableBatching: true });
    const computed = createNode(([value]) => value, [source]);

    let error;
    try {
        ReactiveNode.batch(() => {
            source.set(1);
            throw new Error("boom");
        });
    } catch (err) {
        error = err;
    }

    t.ok(error instanceof Error, "Original error propagates from batch");
    t.is(ReactiveNode.batchMode, false, "batchMode flag resets even when an error is thrown");
    t.is(ReactiveNode.pendingUpdates.size, 0, "Pending updates set clears after flush");
    await sleep(10);
    t.is(computed.value, 1, "Dependent nodes still observe updates after error");

    source.complete();
    computed.complete();
});

test("force update on stateful node re-emits same value", async t => {
    const state = createNode(100);
    let emissions = [];
    state.subscribe(v => emissions.push(v));
    state.update();
    await sleep(50);
    t.is(emissions.length, 2, "update() forces a re-emission even if value is unchanged");
});

test("deep nodes emit when nested data mutates in-place via update()", async t => {
    const node = createNode({ stats: { count: 1 } });
    const emissions = [];
    node.subscribe(v => emissions.push(v.stats.count));

    node.update(current => {
        current.stats.count = 2;
        return current;
    });

    await sleep(50);
    t.is(emissions.length, 2, "subscriber sees the in-place mutation");
    t.is(emissions[1], 2, "nested mutation value propagates");
});

test("deep nodes emit when nested data mutates in-place via set()", async t => {
    const node = createNode({ stats: { count: 1 } });
    const emissions = [];
    node.subscribe(v => emissions.push(v.stats.count));

    const current = node.value;
    current.stats.count = 3;
    node.set(current);

    await sleep(50);
    t.is(emissions.length, 2, "subscriber re-emits after set() with mutated value");
    t.is(emissions[1], 3, "nested mutation via set() propagates");
});

test("update() on stateful node works with function and direct value", async t => {
    const state = createNode(50);
    let emitted;
    state.subscribe(v => emitted = v);
    state.update(val => val + 10);
    await sleep(50);
    t.is(emitted, 60, "Function update worked correctly");
    state.update(100);
    await sleep(50);
    t.is(emitted, 100, "Direct value update worked correctly");
    state.update();
    await sleep(50);
    t.is(emitted, 100, "Re-emission returned the same value");
});

/* --------------------------------------------------------------------------
   Dependency Management Tests (Positional & Named Modes)
-------------------------------------------------------------------------- */

test("Positional mode: add and remove dependency", t => {
    // Create stateful nodes.
    const a = createNode(1), b = createNode(2), c = createNode(3), d = createNode(4);
    // Computed node initially depends on [a].
    const computed = createNode((...vals) => vals.reduce((sum, x) => sum + x, 0), [a]);
    t.is(computed.value, 1, "Initial value with only a");

    computed.addDependency(b);
    t.is(computed.value, 3, "After adding b");

    computed.addDependency(c, d);
    t.is(computed.value, 10, "After adding c and d");

    computed.removeDependency(b);
    t.is(computed.value, 8, "After removing b");

    computed.removeDependency([c, d]);
    t.is(computed.value, 1, "After removing c and d");
});

test("Named mode: add and remove dependency", async t => {
    const a = createNode(10), b = createNode(20), c = createNode(30);
    const computed = createNode(({ a, b, c }) => (a || 0) + (b || 0) + (c || 0), { a });
    t.is(computed.value, 10, "Initial value with only a");

    computed.addDependency('b', b);
    t.is(computed.value, 30, "After adding b by key");

    computed.addDependency({ c });
    t.is(computed.value, 60, "After adding c via object");

    computed.removeDependency('b');
    t.is(computed.value, 40, "After removing dependency 'b'");

    computed.removeDependency(c);
    t.is(computed.value, 10, "After removing dependency c by reference");

    computed.addDependency('b', b);
    await sleep(0);
    t.is(computed.value, 30, "After re-adding b");
    computed.removeDependency(b);
    await sleep(0);
    t.is(computed.value, 10, "After removing dependency with object removal");
});

/* --------------------------------------------------------------------------
   Async Computed Node Tests
-------------------------------------------------------------------------- */

test("computed node handles promise async computation", async t => {
    t.plan(2);
    const dep = createNode(5);
    const asyncPromiseNode = createNode(
        ([a]) => new Promise(resolve => setTimeout(() => resolve(a * 2), 50)),
        [dep]
    );
    t.ok(asyncPromiseNode.isAsync, "Node marked as async with promise");
    await sleep(100);
    t.is(asyncPromiseNode.value, 10, "Computed value updated from promise");
});

test("computed node handles observable async computation", async t => {
    t.plan(2);
    const dep = createNode(4);
    const asyncObservableNode = createNode(
        ([a]) => of(a + 3).pipe(delay(50)),
        [dep]
    );
    t.ok(asyncObservableNode.isAsync, "Node marked as async with observable");
    await sleep(100);
    t.is(asyncObservableNode.value, 7, "Computed value updated from observable");
});

test("computed node remains sync when returning a plain value", async t => {
    t.plan(2);
    const dep = createNode(10);
    const syncComputed = createNode(([a]) => a + 1, [dep]);
    await sleep(50);
    t.absent(syncComputed.isAsync, "Node remains synchronous for plain values");
    t.is(syncComputed.value, 11, "Computed value is correct");
});

/* --------------------------------------------------------------------------
   Error Handling and Completion Tests
-------------------------------------------------------------------------- */

test("computed node notifies error callback when computation throws", async t => {
    t.plan(1);
    const source = createNode(5);
    const faulty = createNode(
        ([a]) => { throw new Error("test error"); },
        [source]
    );
    faulty.subscribe({
        next: () => t.fail("No next value should be received"),
        error: err => t.is(err.message, "test error", "Error callback triggered")
    });
    source.set(6);
    await sleep(50);
});

test("node.error triggers error callbacks", async t => {
    t.plan(1);
    const node = createNode();
    node.subscribe({
        next: () => t.fail("Should not receive a next value"),
        error: err => t.is(err.message, "explicit error", "Error callback triggered")
    });
    node.error(new Error("explicit error"));
    await sleep(50);
});

test("complete() notifies subscribers and prevents further updates", async t => {
    t.plan(3);
    const node = createNode();
    let completeCalled = false;
    let updateCalled = false;
    node.subscribe({
        next: () => updateCalled = true,
        complete: () => { completeCalled = true; t.pass("Complete callback called"); }
    });
    node.complete();
    node.set(200);
    await sleep(50);
    t.ok(completeCalled, "Complete was called");
    t.absent(updateCalled, "No updates after completion");
});

test("subscribing to a completed node immediately triggers complete", async t => {
    t.plan(1);
    const node = createNode(50);
    node.complete();
    node.subscribe({
        next: () => t.fail("No emission should occur"),
        complete: () => t.pass("Immediate completion notification")
    });
    await sleep(50);
});

test("subscribeOnce triggers a single emission", async t => {
    t.plan(1);
    const node = createNode(0);
    let callCount = 0;
    node.once.subscribe(() => callCount++);
    node.set(1);
    node.set(2);
    await sleep(50);
    t.is(callCount, 1, "subscribeOnce only triggered once");
});

/* --------------------------------------------------------------------------
   Nested Object/Array Update Tests
-------------------------------------------------------------------------- */

test("node triggers update when nested object changes", async t => {
    t.plan(2);
    const initialObj = { a: { b: 1 } };
    const node = createNode(initialObj);
    let callCount = 0;
    node.subscribe(val => {
        callCount++;
        if (callCount === 1) t.alike(val, initialObj, "Initial value matches");
        else if (callCount === 2) t.alike(val, { a: { b: 2 } }, "Nested update triggers emission");
    });
    node.set({ a: { b: 1 } }); // Deep equal, no emission.
    await sleep(50);
    node.set({ a: { b: 2 } });
});

test("node triggers update when nested array changes", async t => {
    t.plan(2);
    const initialArr = [1, [2, 3]];
    const node = createNode(initialArr);
    let callCount = 0;
    node.subscribe(val => {
        callCount++;
        if (callCount === 1) t.alike(val, initialArr, "Initial array matches");
        else if (callCount === 2) t.alike(val, [1, [2, 4]], "Nested array update triggers emission");
    });
    node.set([1, [2, 3]]);
    await sleep(50);
    node.set([1, [2, 4]]);
});

/* --------------------------------------------------------------------------
   CommandNode and NO_EMIT Tests
-------------------------------------------------------------------------- */

test("computed node does not emit when NO_EMIT is returned", async t => {
    const a = createNode(5);
    const computed = createNode(
        ([a]) => (a < 10 ? NO_EMIT : a * 2),
        [a]
    );
    let emissions = [];
    computed.subscribe(val => emissions.push(val));
    await sleep(0);
    t.ok(computed.value === NO_EMIT, "Computed node remains in NO_EMIT state");
    t.absent(computed.isActive, "Computed node inactive when NO_EMIT");
    t.is(emissions.length, 0, "No emission on NO_EMIT");
    a.set(12);
    await sleep(50);
    t.is(computed.value, 24, "Computed updates correctly when condition met");
    t.is(emissions.length, 1, "One valid emission occurred");
});

test("stateful node does not emit when set() is called with NO_EMIT", async t => {
    const node = createNode(100);
    let emissions = [];
    node.subscribe(val => emissions.push(val));
    node.set(NO_EMIT);
    await sleep(50);
    t.is(node.value, 100, "Value remains unchanged on NO_EMIT");
    t.is(emissions.length, 1, "No additional emission occurred");
});

test("Subscriber does not emit anything after initial when value is NO_EMIT", async t => {
    t.plan(1);
    const a = createNode(5);
    const b = createNode(() => NO_EMIT, a);
    b.subscribe(() => t.fail("Should not emit"));
    await sleep(10);
    t.pass();
});

test("Stateful node with NO_EMIT value prevents computed execution", async t => {
    const a = createNode(NO_EMIT);
    const b = createNode(() => t.fail("Should not compute"), a);
    await sleep(10);
    t.pass();
});

/* --------------------------------------------------------------------------
   Batching Configuration Tests
-------------------------------------------------------------------------- */

test("computed node with disableBatching true updates synchronously", async t => {
    let computeCount = 0;
    const dep = createNode(5);
    const computed = createNode(
        ([val]) => {
            computeCount++;
            return val * 2;
        },
        [dep],
        { disableBatching: true }
    );
    t.is(computed.value, 10, "Initial computed value is 10");
    t.is(computeCount, 2, "Sync computation ran twice initially");
    dep.set(6);
    await sleep();
    t.is(computed.value, 12, "Computed updates immediately to 12");
    t.is(computeCount, 3, "Computation ran after dependency update");
});

test("computed node with batching enabled updates asynchronously", async t => {
    let computeCount = 0;
    const dep = createNode(5);
    const computed = createNode(
        ([val]) => {
            computeCount++;
            return val * 2;
        },
        [dep]
    );
    t.is(computed.value, 10, "Initial computed value is 10");
    t.is(computeCount, 1, "Initial computation ran once");
    dep.set(6);
    t.is(computed.value, 10, "Value remains until batch flush");
    await sleep(0);
    t.is(computed.value, 12, "Computed updates after microtask flush");
    t.is(computeCount, 3, "Computation ran after flush");
});

test("computed node with disableBatching bypasses batch mode", async t => {
    let computeCount = 0;
    const dep = createNode(5);
    const computed = createNode(
        ([val]) => {
            computeCount++;
            return val * 2;
        },
        [dep],
        { disableBatching: true }
    );
    t.is(computed.value, 10, "Initial computed value is 10");
    t.is(computeCount, 2, "Initial computation count correct");
    batch(() => {
        dep.set(3);
        dep.set(7);
    });
    await sleep();
    t.is(computed.value, 14, "Computed updates immediately during batch");
    t.is(computeCount, 4, "Immediate computation inside batch");
});

test("unbatched getter reflects disableBatching flag", t => {
    const dep = createNode(3);
    const computed1 = createNode(([val]) => val + 1, [dep], { disableBatching: true });
    t.ok(computed1.unbatched, "unbatched is true when disableBatching is set");
    const computed2 = createNode(([val]) => val + 1, [dep]);
    t.absent(computed2.unbatched, "unbatched is false by default");
});

test("unbatched receives every single change", async t => {
    const dep = createNode(undefined, {disableBatching: true});
    const result = [];

    createNode(n => result.push(n), dep, { disableBatching: true });

    dep.set(1);
    dep.set(2);
    dep.set(3);
    dep.set(7);
    dep.set(12);
    t.alike(result, [1,2,3,7,12]);
});

/* --------------------------------------------------------------------------
   Additional Tests using nodeFactory and Composite Nodes
-------------------------------------------------------------------------- */


// COMPOSITE CHANGES doesn't agree with nodeFactory, skipping for now as
// there is a possibility of phasing out the node factory in next major.
skip("Node factory object and composite node", async t => {
    const { node1, node2 } = nodeFactory(5);
    t.is(node1.value, 5);
    t.is(node1.value, node2.value);
    const nodes = nodeFactory(6);
    nodes.x.set(5);
    nodes.y.set(1);
    nodes.z.set(1001);
    nodes.w; // just need to get it to register it with default.
    nodes.x.once.subscribe(x => t.is(x, 5));
    const composite = createComposite(nodes, {disableBatching: true});
    const comp = createNode(
        ([{ x, y, z, w }]) => `${x} ${y} ${z} ${w}`,
        [composite]
    );
    await sleep();
    t.is(comp.value, "5 1 1001 6");
    nodes.clear();
    comp.complete();
    composite.complete();
});

test("Node factory array with observable dependencies", async t => {
    const [x, y, z] = nodeFactory("hello");
    y.set("world");
    z.next("!!!");
    const value = await firstValueFrom(
        concat(x.once, y.once, z.once)
            .pipe(take(3), toArray(), map(arr => arr.join(" ")))
    );
    t.is(value, "hello world !!!");
});

test("Object node derivation", async t => {
    const objState = createNode({ color: "red", size: 10 });
    const color = createNode(([{ color }]) => color, [objState]);
    const size = createNode(([{ size }]) => size, [objState]);
    await sleep(1);
    t.is(color.value, "red");
    t.is(size.value, 10);
});

test("return a node from computed node", async t => {
    const node = createNode(5);
    const computed = createNode(([a]) => node, [node]);
    t.is(computed.value, 5);
    node.set(10);
    await sleep(50);
    t.is(computed.value, 10);
});

test("pass a node as static dependency", async t => {
    const node1 = createNode(10);
    const node2 = createNode(node1);
    const node3 = createNode(x => x, node2);
    t.is(node3.value, 10);
    t.is(node2.value.value, 10);
    node1.set(20);
    await sleep(50);
    t.is(node2.value.value, 20);
    t.is(node3.value, 20);
});

test("pass a function (sync and async) as dependency", async t => {
    // Sync function dependency.
    const x = createNode(([y]) => y + 2, [() => 3]);
    t.is(x.value, 5);
    // Async function dependency.
    const xAsync = createNode(([y]) => (y ? y + 2 : 0), [async () => 3]);
    await sleep(10);
    t.is(xAsync.value, 5);
});

test("function dependency with side effect", async t => {
    t.plan(1);
    let n = 0;
    const getter = () => n;
    const x = createNode(([y]) => y * 2 || 50, [getter]);
    const values = [];
    const timer = setInterval(() => {
        x.update();
        n++;
    }, 100);
    x.subscribe({
        next: o => {
            values.push(o);
            if (values.length === 4) {
                clearInterval(timer);
                x.complete();
            }
        },
        complete: () => t.alike([50, 2, 4, 6], values, "Values emitted are correct")
    });
});

test("synchronous and async function dependencies re-compute correctly", async t => {
    // Synchronous
    let counter = 10;
    const getterSync = () => counter;
    const nodeSync = createNode(([v]) => v + 1, [getterSync]);
    t.is(nodeSync.value, 11, "Sync dependency computed correctly");
    counter = 20;
    nodeSync.update();
    t.is(nodeSync.value, 21, "Sync dependency updated correctly");

    // Async
    let num = 5;
    const getterAsync = async () => {
        await sleep(10);
        return num;
    };
    const nodeAsync = createNode(([v]) => v * 3, [getterAsync]);
    await sleep(20);
    t.is(nodeAsync.value, 15, "Async dependency computed correctly");
    num = 7;
    nodeAsync.update();
    await sleep(20);
    t.is(nodeAsync.value, 21, "Async dependency updated correctly");
});

test("remove dependency (positional and named modes)", async t => {
    // Positional mode.
    let a = 2, b = 3;
    const dep1 = () => a;
    const dep2 = () => b;
    const posNode = createNode(([x, y = 0]) => x + y, [dep1, dep2]);
    t.is(posNode.value, 5, "Positional: initial sum is 5");
    posNode.removeDependency(dep2);
    posNode.update();
    await sleep(10);
    t.is(posNode.value, 2, "Positional: after removal, value is 2");

    // Named mode.
    let m = 10, n = 20;
    const namedNode = createNode(
        ({ a, b }) => (a || 0) + (b || 0),
        { a: () => m, b: () => n }
    );
    await sleep(10);
    t.is(namedNode.value, 30, "Named: initial sum is 30");
    namedNode.removeDependency("b");
    namedNode.update();
    await sleep(10);
    t.is(namedNode.value, 10, "Named: after removal of b, value is 10");
});

test("Check equality of node", async t => {
    const x = createNode(1);
    const c = createNode(x);
    const y = createNode(r => r, () => c.value === x);
    t.ok(y.value);
    c.set(y);
    await sleep();
    t.absent(y.value);
});

test("Add dependency if dependency is singular should error use setDependencies for singular", async t => {
    const computed = createNode((x) => x + 1, () => 5);
    t.exception(() => computed.addDependency(() => 3));
    computed.setDependencies(() => 3);
    await sleep();
    t.is(computed.value, 4);
});

test("Ensure that rxjs observable can cause triggers", async t => {
    const obs = new Subject();

    const comp = createNode(([x]) => {
        return x + x;
    }, [obs]);

    obs.next(5);

    await sleep();
    t.is(comp.value, 10);
    obs.next(10);
    await sleep();
    t.is(comp.value, 20);
});

test("Ensure that rxjs observable can cause triggers in async computed", async t => {
    const obs = new Subject();

    const comp = createNode(async ([x]) => {
        return x + x;
    }, [obs]);

    obs.next(5);

    await sleep();
    t.is(comp.value, 10);
    obs.next(10);
    await sleep();
    t.is(comp.value, 20);
});

test("Ensure that when a node completes or errors, it calls cleanup", async t => {
    t.plan(2);
    const completeThis = createNode(25, { onCleanup: () => t.pass() });
    const errorThis = createNode(x => x, undefined, {onCleanup: (e) => t.ok(e)});

    completeThis.complete();
    errorThis.error(new Error("Okay"));
});
