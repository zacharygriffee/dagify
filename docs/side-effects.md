# **Managing Side Effects in Dagify**

Dagify is primarily designed for managing reactive state and dependencies, but real-world applications require handling **side effects**—operations that interact with external systems (e.g., logging, HTTP requests, database writes, UI updates). Given Dagify’s functional-reactive approach, side effects need to be managed properly to maintain reactivity without unintended behaviors.

---

## **1. Understanding Side Effects in Dagify**
### **What Qualifies as a Side Effect?**
A **side effect** is any operation that interacts with the outside world or produces changes that are not purely reactive. Examples include:
- Fetching data from an API
- Writing to a database or filesystem
- Triggering UI updates (e.g., DOM manipulations)
- Logging events to an external service

Dagify, being a reactive graph system, ensures that computed nodes **re-run only when dependencies change**. This means that if side effects are handled inside computed nodes without control, they **may execute multiple times**, leading to redundant operations.

---

## **2. Best Practices for Handling Side Effects in Dagify**
### **(A) Using `subscribe()` for Controlled Effects**
Since **computed nodes should remain pure functions**, you should **not** place side effects inside computed nodes. Instead, use `.subscribe()` to listen for changes and trigger effects when necessary.

**Example: Trigger an API call when a stateful node updates**
```javascript
import { createNode } from "dagify";

const userId = createNode(1); // Stateful node
const userData = createNode(null); // Store user data

userId.subscribe(async (id) => {
    if (id !== null) {
        const response = await fetch(\`https://api.example.com/users/\${id}\`);
        userData.set(await response.json());
    }
});
```
**Why?**
- `userId.subscribe()` ensures the API request **only** fires when `userId` changes.
- The request is **not inside a computed node**, preventing unnecessary executions.

---

### **(B) Using `.once.subscribe()` for One-Time Effects**
If an effect should run only **once**, use `.once.subscribe`. 

**Example: Log a message only once per node update**
```javascript
userId.once.subscribe((id) => {
    console.log("User ID changed to:", id);
});
```
- `.once()` ensures logging happens **only once**, avoiding redundant logs.

---

### **(C) Using `batch()` for Grouped Side Effects**
If multiple updates should happen together (e.g., when setting multiple nodes), wrap them in `batch()` to prevent unnecessary recomputations.

**Example: Update multiple nodes in a single batch**
```javascript
import { batch } from "dagify";

const firstName = createNode("John");
const lastName = createNode("Doe");
const fullName = createNode(() => \`\${firstName.value} \${lastName.value}\`, [firstName, lastName]);

fullName.subscribe((name) => console.log("Updated full name:", name));

batch(() => {
    firstName.set("Jane");
    lastName.set("Smith");
});
```
**Why?**
- `batch()` ensures `fullName` updates **only once**, reducing redundant updates.

---

### **(D) Handling Async Side Effects in Computed Nodes**
Computed nodes should remain **pure**, but if you need to handle async effects, manage them **outside** computed nodes.

**Incorrect Example: Fetching inside a computed node (DON’T DO THIS)**
```javascript
const user = createNode(async () => {
    const response = await fetch("https://api.example.com/user");
    return await response.json();
}); // ❌ This can cause unintended behavior
```
**Why is this bad?**
- If dependencies update frequently, the API call may **fire multiple times unexpectedly**.
- No proper control over side effects.

✅ **Correct Approach: Use a separate subscription**
```javascript
const fetchUser = createNode(false); // Trigger node
const userData = createNode(null);

fetchUser.subscribe(async (trigger) => {
    if (trigger) {
        const response = await fetch("https://api.example.com/user");
        userData.set(await response.json());
    }
});
```
- `fetchUser.set(true)` will **trigger the API call once**, ensuring controlled side effects.

---

### **(E) Using Effect Helpers for Structured Side Effects**
Dagify provides sink/command/bridge helpers under `dagify/effect` so you can isolate side effects while keeping the rest of the graph pure.

```javascript
import { createNode } from "dagify";
import { sink, command } from "dagify/effect";

const logSink = sink(value => console.log("Log:", value));
const submitUser = command("@user/submit", async payload => {
  await api.saveUser(payload);
  return { status: "ok" };
});

const formState = createNode({ name: "Anna" });
formState.subscribe(value => logSink.set(value));
submitUser.set(formState.value);
```

- `sink` nodes are terminal consumers that execute side effects.
- `command` nodes provide validation/mapping hooks and can be driven via the shared dispatcher.

---

### **(F) Auto-invoking Cleanup Hooks**
Need to trigger a method on whatever the node emits (e.g., a `cleanup()` function)? Use `invokeOnNode` to keep the invocation isolated inside a sink node.

```javascript
import { createNode, NO_EMIT, invokeOnNode } from "dagify";

const resource = createNode(NO_EMIT);
const disposeSideEffect = invokeOnNode(resource, "cleanup");

resource.set({
  cleanup() {
    console.log("Tearing down resource");
  }
});
```

- The sink only calls the target method when it exists, letting you emit structured payloads without mixing side effects into the rest of the graph.

---

## **3. Common Pitfalls and How to Avoid Them**
| Mistake | Why It’s a Problem | Correct Approach |
|---------|-------------------|-----------------|
| Performing side effects inside computed nodes | May execute multiple times unexpectedly | Use `.subscribe()` instead |
| Fetching data without controlling execution | Can lead to race conditions and duplicate requests | Use `once.subscribe()` or explicit trigger nodes |
| Not batching updates | Causes excessive re-renders and performance issues | Use `batch()` to group updates |
| Using stateful nodes for side effects directly | Makes debugging and testing harder | Separate stateful nodes from effect triggers |
| Forgetting effect helpers | Leads to ad-hoc side-effect management | Use `dagify/effect` (`sink`, `command`, `bridge`, `invokeOnNode`, etc.) |

---

## **4. Summary: Handling Side Effects Effectively**
| Scenario | Best Practice |
|----------|--------------|
| **Trigger an effect when a node updates** | Use `.subscribe()` |
| **Run an effect only once** | Use `.once()` |
| **Batch multiple updates** | Use `batch()` |
| **Control async operations** | Use explicit trigger nodes |
| **Avoid excessive executions** | Use `skip()`, `once.subscribe()` |
| **Isolate effectful nodes** | Use helpers from `dagify/effect` |

---

By following these best practices, you can ensure side effects are handled **efficiently and predictably** in Dagify, keeping your reactive graph **clean and performant**.
