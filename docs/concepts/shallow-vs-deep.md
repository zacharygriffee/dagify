# Shallow vs. Regular vs. Reference Nodes in Dagify

Dagify supports three common sensitivity models:
1. **Regular (Deep) Reactive Nodes**
2. **Shallow Reactive Nodes** (including shallow computed)
3. **Reference Nodes** (emit only on `===` change)

The difference lies in **how reactivity propagates** and how **computed nodes evaluate changes**.

---

## 1. Regular (Deep) Reactive Nodes
### Definition
A **regular reactive node** deeply tracks changes inside **nested objects, arrays, or structures**. Any modification, even deeply nested, **triggers reactivity**.

### Behavior
- Uses **reference tracking** for objects and arrays.
- Updates to **nested properties** trigger reactivity.
- Computed nodes **always recompute** if dependencies change.

### Example
```javascript
import { createNode } from "dagify";

const user = createNode({ name: "Alice", details: { age: 30 } });

user.subscribe(console.log); // Logs every update

// Updating a nested property (Triggers reactivity)
user.value.details.age = 35;
user.update();  // Triggers notification
```

### Use Cases
✔ Best for **UI components** where nested state tracking is crucial.  
✔ Ideal for **computed nodes** that depend on object properties.  
✔ Suitable for managing **complex state objects**.

---

## 2. Shallow Reactive Nodes
### Definition
A **shallow reactive node** only tracks **top-level changes**. It **does not react to modifications inside nested structures** unless the **entire object is replaced**.

### Behavior
- Uses **shallow equality checking** (`shallowEqual`).
- Changes to **nested properties do not trigger updates**.
- Only emits updates if the **top-level reference changes**.

### Example
```javascript
import { createShallowNode } from "dagify/shallow";

const user = createShallowNode({ name: "Alice", details: { age: 30 } });

user.subscribe(console.log); // Logs updates only on top-level change

// Updating a nested property (Does NOT trigger reactivity)
user.value.details.age = 35;
user.update();  // No effect

// Replacing the whole object (Triggers reactivity)
user.set({ name: "Bob", details: { age: 35 } }); // Logs new value
```

### How It Works Internally
```javascript
class ShallowReactiveNode extends ReactiveNode {
    _setValue(newValue, forceEmit = false) {
        const prevValue = this.value;
        this.value = newValue;
        if (forceEmit || !shallowEqual(prevValue, newValue)) {
            this._notifyAll('next', newValue);
        }
    }
}
```

✔ **Nested property changes do not trigger reactivity.**  
✔ **Only top-level assignments cause updates.**  
✔ **Efficient reactivity for large objects.**  

---

## 3. Shallow Computed Nodes
### Definition
A **shallow computed node** derives its value from dependencies but **only emits an update if the new computed value is not shallowly equal** to the previous value.

### Behavior
- Computed nodes **depend on other reactive nodes**.
- Uses **shallow equality** for change detection.
- Emits updates **only if the new value differs shallowly** from the last computed value.

### Example
```javascript
import { createNode } from "dagify";
import { createShallowNode } from "dagify/shallow";

// Create a reactive node
const count = createNode(0);

// Create a shallow computed node
const double = createShallowNode(() => ({ value: count.value * 2 }), [count]);

double.subscribe(console.log); // Logs updates only on shallow change

// Changing count updates the computed node
count.set(1); // Logs: { value: 2 }
count.set(1); // No log (shallowly equal)
count.set(2); // Logs: { value: 4 }
```

### How It Works Internally
```javascript
class ShallowComputedNode extends ShallowReactiveNode {
    constructor(fn, dependencies) {
        super();
        this.compute = fn;
        this.dependencies = dependencies;
        this.update();
    }
  
    update() {
        const newValue = this.compute();
        this._setValue(newValue);
    }
}
```

✔ **Computed values only emit when they change shallowly.**  
✔ **Avoids unnecessary recomputation and re-renders.**  
✔ **Efficient tracking for derived state.**  

---

## 4. Reference Nodes
### Definition
`createReferenceNode` only emits when the **top-level reference changes** (`===`). No structural comparison is performed.

### Behavior
- Treats reuse of the same instance as **no change**.
- Emits on any new reference, even if the shape/content is identical.
- Accepts dependencies/config like `createNode`, so you can build reference-based computed nodes.

### Example
```javascript
import { createReferenceNode } from "dagify";

const connection = createReferenceNode({ socket: socketA });
connection.subscribe(conn => console.log("connection changed", conn.socket.id));

connection.set(connection.value); // no emission
connection.set({ socket: socketA }); // emits (new reference)
```

### Use Cases
- **Imperative integrations**: network/storage handles, SDK clients, connection/session objects.
- **Identity-sensitive flows**: when downstream consumers care about instance identity, not structural equality.
- **Performance**: avoid deep/shallow checks entirely; move churn to explicit reference swaps.

## 5. Key Differences at a Glance
| Feature | Regular Reactive Node | Shallow Reactive Node | Reference Node |
|---------|----------------------|-----------------------|----------------|
| Tracks nested props | ✅ Yes | ❌ No | ❌ No |
| Emits on nested mutation | ✅ Yes | ❌ No | ❌ No |
| Emits on new reference | ✅ Yes | ✅ Yes | ✅ Yes (only trigger) |
| Comparison | Deep | Shallow | Reference (`===`) |
| Typical use | Fine-grained UI/business logic | Large objects, caches, derived snapshots | External handles (network/storage), identity-sensitive consumers, performance-critical flows |

---

## 6. When to Use Which?
- **Regular nodes**: fine-grained reactivity (UI, complex computed graphs).
- **Shallow nodes**: large objects or derived snapshots where top-level swaps are enough.
- **Reference nodes**: imperative resources (network/storage/clients), or when you want emissions only on identity change.

---

## 7. API Usage
Dagify provides dedicated helpers:

### Creating a Shallow Reactive Node
```javascript
import { createShallowNode } from "dagify/shallow";

const shallowUser = createShallowNode({ name: "Alice" });
```

### Creating a Shallow Computed Node
```javascript
import { createNode } from "dagify";
import { createShallowNode } from "dagify/shallow";

const count = createNode(0);
const double = createShallowNode(() => ({ value: count.value * 2 }), [count]);
```

### Creating a Reference Node
```javascript
import { createReferenceNode } from "dagify";

const storage = createReferenceNode(makeStorageClient());
storage.set(makeStorageClient()); // emits because the instance changed
```
