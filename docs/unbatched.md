# 📘 **Dagify Unbatched API**

## Overview

Dagify supports an `unbatched` mode for nodes that require immediate execution and update propagation, bypassing the standard batching mechanism.

This feature is essential for scenarios where **real-time responsiveness** is critical—such as dispatch commands, events, or nodes managing external systems—where missing intermediate states could lead to inconsistencies.

---

## 🔧 **Configuration**

### `disableBatching` (Boolean)

- **Type:** `boolean`
- **Default:** `false`
- **Description:** If `true`, the node bypasses Dagify’s batching system and emits every update immediately.

When `disableBatching` is enabled, all changes are processed synchronously, ensuring that no state updates are missed.

---

## 🚀 **Creating Unbatched Nodes**

### 1️⃣ **Using the `disableBatching` Config**

You can pass `disableBatching: true` directly when creating a node:

```js
import { createNode } from 'dagify';

// Create an unbatched node
const unbatchedNode = createNode(0, null, { disableBatching: true });

// Subscribe to every change immediately
unbatchedNode.subscribe(value => {
  console.log('Immediate update:', value);
});
```

---

### 2️⃣ **Creating Unbatched Computed Nodes**

Computed nodes can also bypass batching by setting `disableBatching: true`:

```js
import { createNode } from 'dagify';

const dep = createNode(0);
const immediateComputed = createNode(
  value => console.log(`Immediate computation: ${value}`),
  dep,
  { disableBatching: true }
);

dep.set(1);
dep.set(2);
dep.set(3);
// Each set will trigger a separate immediate computation
```

---

## 🎯 **Example: Command Nodes with Unbatched Updates**

Certain commands require precise, real-time execution without batching:

```js
import { command } from 'dagify/effect';

const critical = command('critical-command', (data) => {
  console.log('Received critical command:', data);
}, [], { disableBatching: true });

// Sending multiple commands that must be processed immediately
critical.next('Initialize');
critical.next('Execute');
critical.next('Finalize');
```

---

## 💡 **When Should You Use `disableBatching`?**

Enable `disableBatching` when:
- **Event consistency** is critical (e.g., command execution, real-time streams).
- Missing an intermediate state could break logic or data flow.
- You need **immediate reaction** to state changes.

Avoid using `disableBatching` for:
- Standard computed nodes that benefit from performance optimizations.
- Bulk data updates where batching improves efficiency.

---

## ❗ **Performance Considerations**

- Using `disableBatching: true` can lead to higher CPU usage, especially with frequent rapid updates.
- Only enable for nodes where **event consistency** is essential.

---

## ✅ **API Reference**

| Config Option   | Type     | Default | Description                               |
|-----------------|----------|---------|-------------------------------------------|
| `disableBatching` | `boolean` | `false` | Bypasses batching and triggers updates immediately |
