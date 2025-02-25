import {solo, test} from "brittle";
import { createNode, NO_EMIT, batch } from "../../lib/node/index.js";
import { createFilterNode } from "../../lib/filter-node/index.js";
import { sleep } from "../helpers/sleep.js";

// Test that if the predicate fails on initialization, no emission occurs.
test("filter node does not emit value when predicate fails on initialization", async t => {
    const source = createNode(3); // odd number
    const filter = createFilterNode(x => x % 2 === 0, source);
    let emissions = [];
    filter.subscribe(val => emissions.push(val));
    await sleep(10);
    source.set(5);
    await sleep(10);
    t.is(emissions.length, 0, "No emission for odd initial value");
    source.set(2);
    await sleep(10);
    t.is(emissions.length, 1, "One valid emission occurred");
});

// Test that if the predicate passes on initialization, the node emits the initial value.
test("filter node emits value when predicate passes on initialization", async t => {
    const source = createNode(4); // even number
    const filter = createFilterNode(x => x % 2 === 0, source);
    let emitted;
    filter.subscribe(val => emitted = val);
    await sleep(50);
    t.is(emitted, 4, "Even initial value emitted");
});

// Test that the filter node emits a new value when the dependency is updated to pass the predicate.
test("filter node emits updated value when predicate passes after update", async t => {
    const source = createNode(3); // starts as odd
    const filter = createFilterNode(x => x % 2 === 0, source);
    let emissions = [];
    filter.subscribe(val => emissions.push(val));
    await sleep(50);
    t.is(emissions.length, 0, "No emission for initial odd value");

    source.set(8); // update to an even number
    await sleep(50);
    t.is(emissions.length, 1, "One emission after updating to even value");
    t.is(emissions[0], 8, "Emitted value is 8");
});

// Test that if the dependency updates to a value failing the predicate, no new emission occurs.
test("filter node does not emit when updated value fails predicate", async t => {
    const source = createNode(4); // even initially
    const filter = createFilterNode(x => x % 2 === 0, source);
    let emissions = [];
    filter.subscribe(val => emissions.push(val));
    await sleep(50);
    t.is(emissions.length, 1, "One emission for initial even value");

    source.set(5); // update to odd value
    await sleep(50);
    t.is(emissions.length, 1, "No new emission for updated odd value");
});

// Test subscribeOnce on a filter node so that it only triggers once.
test("filter node subscribeOnce triggers only once", async t => {
    const source = createNode(2); // even
    const filter = createFilterNode(x => x % 2 === 0, source);
    let callCount = 0;
    filter.once.subscribe(val => {
        callCount++;
        t.is(val, 2, "subscribeOnce receives the even value");
    });
    // Update source to another even number; subscribeOnce should not trigger again.
    source.set(4);
    await sleep(50);
    t.is(callCount, 1, "subscribeOnce only triggered once");
});


// Test that a filter node can integrate within a reactive chain.
test("filter node integrates with computed nodes", async t => {
    const source = createNode(5); // odd value, so filter will return NO_EMIT and prevent computed execution
    const filter = createFilterNode(x => x % 2 === 0, [source]);
    // Computed node simply doubles the input value.
    // Its computation function is never called if any dependency returns NO_EMIT.
    const computed = createNode(
        ([val]) => val * 2,
        [filter]
    );
    let emissions = [];
    computed.subscribe(val => emissions.push(val));

    await sleep(50);
    // Since filter returns NO_EMIT for the initial odd value, computed should not emit.
    t.is(emissions.length, 0, "Computed node does not emit when dependency is NO_EMIT");

    source.set(6); // update source to an even number
    await sleep(50);
    t.is(computed.value, 12, "Computed outputs correct double of even value");
    t.is(emissions.length, 1, "One valid emission occurred after valid update");
});
