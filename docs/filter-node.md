# Filter Node Documentation

The `createFilterNode` function is a utility that creates a reactive filter node. This node evaluates incoming values using a provided predicate function and only emits those values that pass the predicate test. If a value does not satisfy the predicate, the node emits a special marker (`NO_EMIT`), indicating that the value should not propagate further in the reactive flow.

---

## Overview

- **Reactive Filtering:** The filter node processes each incoming value (referred to as the "subject") and applies a predicate function to determine if it should be emitted.
- **Emission Control:** If the predicate returns a truthy value, the node emits the original value; if not, it does not emit.
- **Integration:** This node is built on top of a reactive system using the `createNode` function, making it easy to incorporate into complex dependency graphs.

---

## How It Works

1. **Input Evaluation:** When the node receives a value, it passes the value to the predicate function.
2. **Decision Making:**
    - **Passes Predicate:** If `predicate(subject)` returns `true`, the node emits the original subject.
    - **Fails Predicate:** If `predicate(subject)` returns `false`, the node emits `NO_EMIT`, effectively filtering out the value.
3. **Dependencies:** The node can have dependencies that, when updated, trigger a re-evaluation of the predicate on the latest value.

---

## Parameters

- **predicate**: `function(*): boolean`  
  A function that tests each incoming value. It should return `true` if the value should be emitted, or `false` if the value should be filtered out.

- **deps**: `Array`  
  An array of dependency nodes. These dependencies determine when the filter node should re-evaluate its predicate. Any change in the dependencies triggers the node to check the incoming value against the predicate again.

---

## Return Value

The function returns a reactive node that encapsulates the filtering logic. This node emits:
- The original value, if it satisfies the predicate.
- `NO_EMIT` (a special marker), if it does not satisfy the predicate.

---

## Usage Example

```js
import { createFilterNode, createNode } from './path/to/your/module';

// Define a predicate that allows only numbers greater than 10
const isGreaterThan10 = (value) => typeof value === 'number' && value > 10;

const stateNode = createNode();
// Create a filter node with the predicate and an empty dependencies array
const filterNode = createFilterNode(isGreaterThan10, stateNode);

// Example: Emitting a value that passes the predicate
stateNode.next(15);  // Emits: 15

// Example: Emitting a value that fails the predicate
stateNode.next(5);   // (does not emit a value)
```

---

## Integration in Reactive Systems

The filter node is designed to seamlessly integrate with other reactive components:
- **Reactive Chains:** Use it as part of a data flow where values are conditionally processed.
- **Dynamic Updates:** Leverage dependency arrays to trigger re-evaluations when underlying data changes.
- **System Compatibility:** Built on the `createNode` API, it works well with other nodes and can be composed within larger reactive graphs.

---

## Conclusion

The `createFilterNode` function provides a straightforward way to filter data in reactive applications. By emitting only those values that meet the specified conditions, it helps maintain efficient and clean reactive pipelines. This makes it an essential tool in scenarios where conditional processing of data is required.