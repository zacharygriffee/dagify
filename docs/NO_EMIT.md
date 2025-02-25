# 🚫 **Dagify NO_EMIT Documentation**

## 🔍 **Overview**

In **Dagify**, `NO_EMIT` is a special symbol used to **suppress emissions** from nodes. When a node’s value is set to `NO_EMIT`, it prevents any emissions from propagating to subscribers or dependent nodes.

This feature is essential for managing conditional updates, optimizing performance, and avoiding unnecessary computations or reactivity loops.

---

## 🛠️ **What Is `NO_EMIT`?**

`NO_EMIT` is a sentinel value that signals a node should **not emit its value** or trigger any updates.

### ✅ **Use Cases**
- **Prevent unnecessary updates**: Skip emitting unchanged or irrelevant values.
- **Initialize nodes without triggering dependencies**.
- **Control dependency updates** in computed nodes when certain conditions are met.

### 📌 **Example**
```js
import { createNode, NO_EMIT } from 'dagify';

const state = createNode(NO_EMIT); // Initial value will not emit

state.subscribe((value) => {
  console.log('Received update:', value);
});

state.set(42); // Will emit 42
state.set(NO_EMIT); // No emission occurs
state.set(100); // Will emit 100
```

---

## 🚦 **Behavior in Computed Nodes**

When any dependency of a computed node has the value `NO_EMIT`, the computed node will **not execute** or update its value.

### 🔥 **Example: Skipping Computation**

```js
import { createNode, NO_EMIT } from 'dagify';

const inputA = createNode(5);
const inputB = createNode(NO_EMIT);

const computed = createNode(
  ([a, b]) => a + b,
  [inputA, inputB]
);

computed.subscribe((value) => {
  console.log('Computed Value:', value);
});

// Only emits when both dependencies have valid values
inputB.set(3); // Now emits 8 (5 + 3)
```

If any dependency has `NO_EMIT`, the computation will be skipped entirely.

---

## 📚 **Working with Initial NO_EMIT Values**

By default, if a node is initialized with `undefined` or `null`, it behaves like `NO_EMIT`. The node will **not emit** until a valid value is explicitly set.

### ✅ **Example: Delayed Initialization**

```js
const deferredNode = createNode(undefined); // Initially acts like NO_EMIT

deferredNode.subscribe((value) => {
  console.log('Value received:', value);
});

deferredNode.set(10); // Emits 10
deferredNode.set(NO_EMIT); // Does not emit
deferredNode.set(20); // Emits 20
```

---

## ⚡ **NO_EMIT in Composite Nodes**

For composite nodes, if **any dependency emits `NO_EMIT`**, the composite node will **suppress its own emission** until all dependencies have valid values.

### 🏗️ **Example: Composite Behavior**

```js
import { createNode, createComposite, NO_EMIT } from 'dagify';

const node1 = createNode(1);
const node2 = createNode(NO_EMIT);

const composite = createComposite([node1, node2]);

composite.subscribe((values) => {
  console.log('Composite values:', values);
});

node2.set(2); // Emits [1, 2]
```

---

## 🚀 **Best Practices for Using `NO_EMIT`**

- Use `NO_EMIT` to **defer emissions** until a valid state is available.
- Combine `NO_EMIT` with conditionals inside computed nodes to prevent unnecessary recomputations.
- Useful for **asynchronous data fetching** to suppress emissions until data is ready.

---

## 📋 **API Reference**

| Feature    | Type     | Description                                               |
|------------|----------|-----------------------------------------------------------|
| `NO_EMIT`  | `Symbol` | Prevents a node from emitting its value or triggering updates. |

---

## ❗ **Limitations**

- A node explicitly set to `undefined` (e.g., `node.set(undefined)`) **will emit** `undefined`. Only the initial `undefined` or `null` values default to `NO_EMIT`.
- If `NO_EMIT` is set on a critical dependency, any downstream computations relying on that node will be blocked until a valid value is provided.