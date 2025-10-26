import test from "brittle";
import { Subject, BehaviorSubject, of } from "rxjs";
import { sleep } from "../helpers/sleep.js";
import {
    createNode,
    map,
    filter,
    combine,
    merge,
    switchLatest,
    from,
    createStore
} from "../../index.js";

test("ReactiveNode exposes stream observable", async t => {
    const node = createNode(1);
    let observed;
    node.stream.subscribe(value => observed = value);
    node.set(2);
    await sleep(10);
    t.is(observed, 2, "stream proxy emits node updates");
});

test("map helper projects node values", async t => {
    const source = createNode(1);
    const doubled = map(source, value => value * 2);
    let last;
    doubled.stream.subscribe(value => last = value);
    source.set(3);
    await sleep(10);
    t.is(last, 6, "map applies projector");
});

test("filter helper suppresses values", async t => {
    const source = createNode(0);
    const evens = filter(source, value => value % 2 === 0);
    const emissions = [];
    evens.stream.subscribe(value => emissions.push(value));
    source.set(1);
    source.set(2);
    await sleep(10);
    t.is(emissions.at(-1), 2, "filter emits final even value");
    t.ok(!emissions.includes(1), "filter omits values that fail predicate");
});

test("combine aggregates array sources", async t => {
    const a = createNode(1);
    const b = createNode(2);
    const combined = combine([a, b], (x, y) => x + y, { initialValue: 0 });
    let result;
    combined.stream.subscribe(value => result = value);
    await sleep(10);
    t.is(result, 3, "combine projects initial state");
    a.set(5);
    await sleep(10);
    t.is(result, 7, "combine updates when dependencies change");
});

test("combine aggregates object sources", async t => {
    const width = createNode(100);
    const height = createNode(200);
    const dims = combine({ width, height });
    let last;
    dims.stream.subscribe(value => last = value);
    width.set(150);
    await sleep(10);
    t.alike(last, { width: 150, height: 200 }, "combine converts values to keyed object");
});

test("merge forwards values from multiple sources", async t => {
    const a = createNode("a");
    const b = createNode("b");
    const merged = merge([a, b]);
    const emissions = [];
    merged.stream.subscribe(value => emissions.push(value));
    a.set("A");
    b.set("B");
    await sleep(10);
    t.alike(emissions.slice(-2), ["A", "B"], "merge emits updates from each source in order");
});

test("switchLatest follows latest inner source", async t => {
    const left = createNode(1);
    const right = createNode(10);
    const selector = new BehaviorSubject(left);
    const switched = switchLatest(selector, node => node);
    let last;
    switched.stream.subscribe(value => last = value);
    left.set(2);
    await sleep(10);
    t.is(last, 2, "switchLatest tracks current source");
    selector.next(right);
    right.set(11);
    await sleep(10);
    t.is(last, 11, "switchLatest switches to new source");
});

test("from wraps observable and promise sources", async t => {
    const subject = new Subject();
    const observableStore = from(subject);
    const promiseStore = from(Promise.resolve(42), { initialValue: 0 });
    let observableValue;
    observableStore.stream.subscribe(value => observableValue = value);
    subject.next(5);
    await sleep(10);
    t.is(observableValue, 5, "from observable forwards emissions");
    await sleep(10);
    t.is(promiseStore.value, 42, "from promise resolves into node value");
});

test("createStore creates basic stateful node", t => {
    const store = createStore(10);
    t.is(store.value, 10, "store initializes with provided value");
});
