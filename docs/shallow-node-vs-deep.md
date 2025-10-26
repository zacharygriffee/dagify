# Shallow vs. Regular Reactive Nodes in Dagify

Dagify supports **two types of reactive nodes**:  
1. **Regular (Deep) Reactive Nodes**  
2. **Shallow Reactive Nodes** (Including **Shallow Computed Nodes**)  

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

## 4. Key Differences at a Glance
| Feature               | Regular Reactive Node | Shallow Reactive Node | Shallow Computed Node |
|----------------------|----------------------|----------------------|----------------------|
| **Tracks Nested Properties** | ✅ Yes | ❌ No | ❌ No |
| **Triggers on Property Mutation** | ✅ Yes | ❌ No | ❌ No |
| **Triggers on Whole Object Change** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Uses Deep Comparison?** | ✅ Yes | ❌ No (Shallow Comparison) | ❌ No (Shallow Comparison) |
| **Reactivity for Computed Nodes** | ✅ Always updates | ✅ Only updates if shallowly unequal | ✅ Only updates if shallowly unequal |
| **Performance** | ⚠ Slightly slower | 🚀 Faster | 🚀 Faster |
| **Use Case** | Fine-grained reactivity (UI, computed nodes) | Large objects, cache, static data | Derived state with optimized reactivity |

---

## 5. When to Use Which?
- **Use Regular Reactive Nodes** if you need **deep reactivity** (e.g., UI components, computed nodes).
- **Use Shallow Reactive Nodes** for **performance-sensitive cases** (e.g., large datasets, caching layers, reducing unnecessary computations).
- **Use Shallow Computed Nodes** when **deriving state from other nodes but want to avoid redundant updates.**

---

## 6. API Usage
Dagify provides **dedicated functions** for shallow nodes:

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
