# CommandNode

`CommandNode` is a specialized reactive node for handling external commands. It integrates optional data validation and mapping, and processes incoming payloads using a provided handler function. The node supports both synchronous and asynchronous handlers, and accepts external updates via `set()` and `next()`, making it compatible with libraries such as RxJS and Svelte stores.

## Overview

- **Purpose:**  
  Process external command payloads with optional data transformation (mapping) and validation.

- **Handler:**  
  A function provided to process the incoming data. It can return a value directly or a promise that resolves to a value.

- **Mapping:**  
  A `map` function can be supplied to transform or modify the incoming data before further processing.

- **Validation:**  
  An optional `validator` function can be used to ensure the data meets expected criteria. It should return an object of the form `{ valid: boolean, error?: Error }`.

- **Compatibility:**  
  The node exposes a `next()` method that delegates to `set()`, making it compatible with RxJS Observables and Svelte stores.

- **Batching:**  
  **By default, batching is disabled** to ensure that each command is processed immediately. However, if your application can tolerate lossy commands—where rapid, successive commands may be coalesced—you can enable batching through configuration.

> **Import tip:** Use the effect namespace to create command nodes:
> ```js
> import { command } from "dagify/effect";
> const updateUser = command("@user/update", payload => payload);
> ```

## Constructor

```js
/**
 * Creates a new CommandNode.
 *
 * @param {string} commandName - Unique identifier for the command.
 * @param {Function} handler - Function that processes the command payload.
 *   Can return a value or a Promise resolving to a value.
 * @param {{disableBatching: boolean}} [config={}] - Optional configuration.
 * @param {Function} [config.validator] - Function that validates incoming data.
 *        Should return an object: { valid: boolean, error?: Error }.
 * @param {Function} [config.map] - Function that transforms the data.
 */
constructor(commandName, handler, config = {})
```

### Parameters

- **commandName:**  
  A unique string that identifies the command.

- **handler:**  
  The function that processes the incoming command payload. This function may perform asynchronous operations.

- **config:**  
  An optional configuration object:
    - `validator`: A function to validate the incoming data.
    - `map`: A function to transform the incoming data before processing.
    - `disableBatching`: Although this is set to `true` by default, it can be overridden to enable batching if lossy commands are acceptable.

## Methods

### set(data)

```js
/**
 * Processes incoming data by applying the mapping function (if provided),
 * validating the data, and then executing the handler.
 * The result from the handler (or its resolved value, if asynchronous)
 * is emitted as the node's state.
 *
 * @param {*} data - The payload for the command.
 */
async set(data)
```

**Behavior:**

1. **Mapping:**  
   If a `map` function is provided, it transforms the incoming data.

2. **Validation:**  
   If a `validator` is provided, the data is validated. If the data is invalid, the node calls `this.error()` with the provided or default error.

3. **Handling:**  
   The (possibly mapped) data is passed to the handler.
    - If the handler returns a promise, it waits for it to resolve or catch any errors.
    - Otherwise, it immediately uses the returned value.

4. **Emission:**  
   The processed result is emitted as the node’s new state (unless the result is a special constant, `NO_EMIT`).

### next(data)

```js
/**
 * Delegates to set(), making CommandNode compatible with RxJS Observables and Svelte stores.
 *
 * @param {*} data - The payload for the command.
 */
next(data)
```

### _setValue(newValue, forceEmit)

```js
/**
 * Updates the node’s value, but does not emit if the new value equals NO_EMIT.
 *
 * @param {*} newValue - The new value for the node.
 * @param {boolean} [forceEmit=false] - Whether to force emission even if unchanged.
 */
_setValue(newValue, forceEmit = false)
```

## Public Exposure Function

The helper function `createCommandNode` creates a new `CommandNode` and automatically binds it to a dispatcher, ensuring that whenever a command event is emitted, the node processes the payload.

```js
/**
 * Creates a CommandNode that automatically binds to the dispatcher.
 *
 * @param {string} commandName - The command identifier.
 * @param {Function} handler - The command handler function.
 * @param {Object} [config] - Optional configuration (validator, map, etc.).
 * @param {string} [context='global'] - Optional context for the dispatcher.
 * @returns {CommandNode} A command node that processes payloads when the dispatcher emits the command.
 */
function createCommandNode(commandName, handler, config = {}, context = 'global') {
    const node = new CommandNode(commandName, handler, config);
    dispatcher.on(commandName, (payload) => {
        node.set(payload);
    }, context);
    return node;
}
```

## Example Usage

```js
import { command, dispatcher } from "dagify/effect";

// Define a validator to ensure the payload has the proper format.
const validator = (data) => {
  if (typeof data.x !== "number" || typeof data.y !== "number") {
    return { valid: false, error: new Error("Invalid vector2 format") };
  }
  return { valid: true };
};

// Define a mapping function to round values.
const map = (data) => ({ x: Math.round(data.x), y: Math.round(data.y) });

// Define an asynchronous handler to compute the vector magnitude.
const handler = async (data) => {
  return Math.sqrt(data.x * data.x + data.y * data.y);
};

// Create a command node bound to the shared dispatcher.
const cmdNode = command("@player/position", handler, { validator, map });

// Trigger manually:
cmdNode.set({ x: 3.2, y: 4.7 });
cmdNode.next({ x: 3.2, y: 4.7 });

// Or emit via dispatcher (equivalent effect):
dispatcher.emit("@player/position", { x: 1, y: 1 });
```

## Summary

- **Immediate Processing by Default:**  
  Batching is disabled by default to ensure that each command is processed immediately. However, you can enable batching if your application can tolerate lossy commands, where rapid, successive commands may be merged.

- **Extensibility:**  
  The separation of mapping and validation from the handler function allows for greater code clarity, reusability, and easier testing.
