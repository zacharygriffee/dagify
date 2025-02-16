// test/eventNodes.test.js
import { test, solo } from 'brittle';
import { EventEmitter } from 'eventemitter3';
import { eventListenerNode, eventEmitterNode } from '../../lib/nodes/events.js';
import {createNode} from "../../index.js";
import {sleep} from "../helpers/sleep.js";

// Test for emitEvent: ensure that the node causes the subject to emit the correct event and value.
test('emitEvent node emits the event with correct data', async t => {
    const subject = new EventEmitter();
    let receivedData = null;

    // Listen for the event on the subject.
    subject.on('my-event', data => {
        receivedData = data;
    });

    // Create an emitEvent node that will emit 'my-event' with the value 42.
    // Here, we pass the dependencies as an array of values.
    const stateNode = createNode(42)
    const node = eventEmitterNode(subject, 'my-event', stateNode);

    t.is(receivedData, 42, 'emitEvent should emit 42 on "my-event"');
    await stateNode.set(24);

    t.is(receivedData, 24, 'emitEvent should emit 24 on "my-event"');
    t.end();
});

// Test for events: ensure that the node receives the event and applies the computed function.
test('events node listens to event and applies computed function', async t => {
    t.plan(2);

    const subject = new EventEmitter();

    // Create an events node that listens for the 'test' event.
    // eventListenerNode is assumed to wrap the subject's event stream.
    const node = eventListenerNode(subject, 'test');

    // Create a node that squares incoming values from the event node.
    const squareNode = createNode(x => x * x, node);

    let received;
    // Subscribe to the square node's output.
    squareNode.subscribe(result => {
        received = result;
    });

    // Emit the 'test' event with a value of 5.
    subject.emit('test', 5);

    // Wait briefly to allow the event to propagate.
    await sleep(0);

    // Verify that the computed function (squaring) has been applied.
    t.is(received, 25, 'events should compute 5 squared (25)');

    // Complete the node, which should remove the listener.
    node.complete();

    // Allow some time for the listener removal to take effect.
    await sleep(0);

    // Check that there are no more listeners for the 'test' event.
    const listenerCount = subject.listenerCount('test');
    t.is(listenerCount, 0, 'listener should be removed after node completion');
});
