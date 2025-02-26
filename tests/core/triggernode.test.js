import {solo, test} from "brittle";
import {createNode} from "../../lib/node/index.js";
import {Subject, interval, fromEvent, of, take} from "rxjs";
import {sleep} from "../helpers/sleep.js";
import {createTrigger, triggerFromEvent} from "../../lib/trigger/index.js";
import {trigger} from "../../lib/trigger/trigger.js";
import EventEmitter from "eventemitter3";

/* --------------------------------------------------------------------------
   ✅ Basic Trigger Tests
-------------------------------------------------------------------------- */

test("trigger() increments on every event emission", async t => {
    const event$ = new Subject();
    const triggered = trigger(event$);

    let values = [];
    triggered.subscribe(value => values.push(value));

    event$.next();
    event$.next();
    event$.next();

    await sleep(50);
    t.alike(values, [1, 2, 3], "Trigger increments correctly on each event");
});

test("trigger() correctly handles multiple observables", async t => {
    const eventA$ = new Subject();
    const eventB$ = new Subject();
    const triggered = trigger([eventA$, eventB$]);

    let values = [];
    triggered.subscribe(value => values.push(value));

    eventA$.next();
    eventB$.next();
    eventA$.next();

    await sleep(50);
    t.alike(values, [1, 2, 3], "Trigger works correctly with multiple observables");
});

test("trigger() works with named observables (object input)", async t => {
    const events = {
        click: new Subject(),
        keypress: new Subject()
    };
    const triggered = trigger(events);

    let values = [];
    triggered.subscribe(value => values.push(value));

    events.click.next();
    events.keypress.next();
    events.click.next();

    await sleep(50);
    t.alike(values, [1, 2, 3], "Trigger correctly increments with named event sources");
});

/* --------------------------------------------------------------------------
   ✅ Handling Different Observable Types
-------------------------------------------------------------------------- */

test("trigger() works with fromEvent", async t => {
    const mockElement = {
        addEventListener: (_, handler) => {
            setTimeout(() => handler(), 10);
            setTimeout(() => handler(), 20);
        },
        removeEventListener: () => {
        }
    };

    const event$ = fromEvent(mockElement, "testEvent");
    const triggered = trigger(event$);

    let values = [];
    triggered.subscribe(value => values.push(value));

    await sleep(50);
    t.alike(values, [1, 2], "Trigger correctly reacts to fromEvent");
});

test("trigger() works with interval", async t => {
    // Ensure any long-living hot observable has its own completion mechanism
    // Nodes do not assume inner observables should complete automatically.
    const interval$ = interval(50).pipe(take(3)); // Emits every 50ms, then completes
    const triggered = trigger(interval$);

    let values = [];
    const sub = triggered.subscribe(value => values.push(value));

    await sleep(160); // Wait longer than 3 emissions (3 * 50ms + buffer)
    sub.unsubscribe(); // Ensure we clean up after the test

    t.alike(values, [1, 2, 3], "Trigger correctly reacts to interval and stops emitting after completion");
});


/* --------------------------------------------------------------------------
   ✅ Manually Controlled Triggers (createTrigger)
-------------------------------------------------------------------------- */

test("createTrigger() creates a manually controlled event trigger", async t => {
    const manualTrigger = createTrigger();
    const triggered = trigger(manualTrigger);

    let values = [];
    triggered.subscribe(value => values.push(value));

    manualTrigger.next();
    manualTrigger.next();
    manualTrigger.next();

    await sleep(50);
    t.alike(values, [1, 2, 3], "Manually triggered values increment correctly");
});

/* --------------------------------------------------------------------------
   ✅ Error Handling
-------------------------------------------------------------------------- */

test("trigger() rejects ReactiveNodes as sources", t => {
    const reactiveNode = createNode(10);

    t.exception(() => trigger(reactiveNode), "trigger() should throw when given a ReactiveNode");
});

test("trigger() rejects invalid input types", t => {
    t.exception(() => trigger(42), "trigger() should throw when given a number");
    t.exception(() => trigger("not an observable"), "trigger() should throw when given a string");
    t.exception(() => trigger({event: 123}), "trigger() should throw when given an object with invalid values");
    t.exception(() => trigger(null), "trigger() should throw when given null");
});

test('calls trigger when source is an EventEmitter', async t => {
    const values = [];
    const ee = new EventEmitter();
    const trigger = triggerFromEvent(ee, "hello");
    const sub = trigger.subscribe(value => values.push(value));

    ee.emit("hello");
    ee.emit("hello");

    t.alike(values, [1, 2]);
    sub.unsubscribe();
    t.is(ee.listenerCount("hello"), 0);
    const sub2 = trigger.subscribe(value => t.is(value, 0, "If listeners went to 0, reactivation of the trigger starts from zero"));
    ee.emit("hello");
    sub2.unsubscribe();
    t.is(ee.listenerCount("hello"), 0);
});

test('calls trigger when source is an EventTarget', t => {
    t.plan(1);
    let listenerCount = 0;
    const mockEventTarget = {
        handler: undefined,
        name: undefined,
        addEventListener(name, _handler) {
            this.name = name;
            this.handler = _handler;
            listenerCount++;
        },
        removeEventListener() {
            this.handler = null;
            listenerCount--;
        },
        dispatchEvent(name) {
            if (name === this.name) this.handler({data: undefined});
        }
    };

    const trigger = triggerFromEvent(mockEventTarget, "hello");

    const sub = trigger.subscribe(event => {
        t.is(event, 1, "EventTarget emits properly");
    });

    mockEventTarget.dispatchEvent("hello");
    sub.unsubscribe();
});

test('throws an error when source is neither an EventEmitter nor an EventTarget', t => {
    const notAnEventSource = {};

    t.exception(() => {
        triggerFromEvent(notAnEventSource, 'someEvent');
    }, /triggerFromEvent must be an EventEmitter or event target./, 'Expected error to be thrown for invalid source');
});
