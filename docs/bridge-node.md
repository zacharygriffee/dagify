# BridgeNode Documentation

The `BridgeNode` is a specialized reactive node that acts as a mediator between an input node and an output node. It is designed to forward incoming values to the input node while keeping its internal value synchronized with the output node's computed value. In Dagify 2.0+, you typically create bridge nodes via the `dagify/effect` namespace (e.g. `import { bridge } from "dagify/effect"`).

## Overview

`BridgeNode` is implemented as a subclass of `ReactiveNode`. It serves two primary functions:

1. **Input Forwarding:** When a new value is set on the `BridgeNode`, it immediately forwards this value to the designated input node.
2. **Value Synchronization:** It subscribes to the output node to update its internal value with any new processed value produced by the output node. If an error occurs during recomputation, it fails silently without notifying subscribers.

## Constructor

```js
/**
 * Creates a new BridgeNode.
 *
 * @param {ReactiveNode} inputNode - The node where updates are fed.
 * @param {ReactiveNode} outputNode - The node that produces the final (processed) value.
 * @param {Object} [config] - Optional configuration.
 */
constructor(inputNode, outputNode, config = {})
```

### Parameters

- **inputNode**: A `ReactiveNode` instance where the new values are fed. The `BridgeNode` forwards any value set to it into this node.
- **outputNode**: A `ReactiveNode` instance that computes and provides the processed value. The `BridgeNode` synchronizes its own value with this node.
- **config** (optional): An object allowing additional configuration. In the implementation, the `skip` property is forced to `1` to adjust the behavior inherited from `ReactiveNode`.

### Initialization Steps

1. **Call Parent Constructor:** The constructor calls `super(NO_EMIT, null, config)` using a static initial value (`null`) and setting `skip` to 1.
2. **Set Initial Value:** The internal value of the `BridgeNode` is immediately updated from the output node’s current value.
3. **Subscription:** It subscribes to the output node. On every new emission (`next` event), the internal value is updated with the latest value from the output node. Errors during recomputation are ignored (silent failure), and completion of the output node results in the `BridgeNode` also completing.

## Methods

### set(newValue)

```js
/**
 * Forwards a new value to the input node.
 * After setting, it forces the output node to recompute.
 * Regardless of whether an error occurs, the BridgeNode updates its internal value
 * from the output node and does not propagate errors.
 *
 * @param {*} newValue - The new value to set.
 * @returns {Promise<void>} A promise that resolves on the next tick.
 */
set(newValue)
```

#### Behavior

- **Value Forwarding:** The new value is immediately passed to the input node via its `set` method.
- **Recomputation Trigger:** A microtask (using `queueMicrotask`) is scheduled to force the output node to compute its new value.
- **Synchronous Update:** After recomputation, the internal value of the `BridgeNode` is updated with the output node's current value.
- **Error Handling:** Errors during output node computation are silently ignored, and no error is propagated to subscribers.
- **Return Value:** The method returns a promise that resolves on the next tick, ensuring any asynchronous updates have been processed.

### complete()

```js
/**
 * Completes the BridgeNode and cleans up its subscription.
 */
complete()
```

#### Behavior

- **Unsubscribe:** If an active subscription to the output node exists, it is unsubscribed and cleared.
- **Call Parent Completion:** The `complete()` method of the parent `ReactiveNode` is called to perform any additional cleanup operations.

## Internal Implementation Details

- **Inheritance:** `BridgeNode` extends `ReactiveNode`, leveraging its reactive capabilities while adding a specific role as a bridge between two nodes.
- **NO_EMIT Usage:** The parent constructor is invoked with `NO_EMIT`, meaning that the `BridgeNode` does not emit an initial value by default.
- **Subscription Handling:** The class maintains an internal subscription (`_outputSubscription`) to listen for changes on the output node. This ensures that any new computed value from the output node immediately reflects on the `BridgeNode`.
- **Microtask Scheduling:** By using `queueMicrotask`, the class ensures that the output node recomputation occurs asynchronously but as soon as possible, keeping the UI or dependent computations responsive.

## Example Usage

```js
import { BridgeNode } from './BridgeNode.js';
import { SomeInputNode, SomeOutputNode } from './nodes.js';

// Instantiate input and output reactive nodes.
const inputNode = new SomeInputNode();
const outputNode = new SomeOutputNode();

// Create a BridgeNode that connects the input and output.
const bridgeNode = new BridgeNode(inputNode, outputNode);

// Subscribe to the BridgeNode to react to updates.
bridgeNode.subscribe({
  next: (value) => {
    console.log("New synchronized value:", value);
  },
  error: (err) => {
    console.error("Error:", err);
  },
  complete: () => {
    console.log("BridgeNode completed.");
  }
});

// Set a new value on the BridgeNode.
bridgeNode.set('example value');
```

In this example:
- A new value is set on `bridgeNode`.
- The value is forwarded to `inputNode`.
- The output node recomputes its value.
- The updated computed value is synchronized back to the `bridgeNode`, which then notifies its subscribers.
