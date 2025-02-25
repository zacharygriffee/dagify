# RxJS Integration and Svelte Store Replacement with Dagify

Dagify is designed to simplify reactive programming by combining a directed acyclic graph (DAG) model with the power of RxJS. Its core construct, the **ReactiveNode**, not only provides stateful and computed reactivity but also naturally exposes an RxJS-based API. Since ReactiveNode extends RxJS’s Subject, it meets the Svelte store contract without any additional adapter.

---

## 1. Overview of ReactiveNode

**ReactiveNode** is the fundamental building block of Dagify. It can be used in two primary ways:

- **Stateful Node:** Created with a plain value (e.g., a number or string). These nodes hold a static value that can be updated using methods such as `set(newValue)` or `update(fn)`.
- **Computed Node:** Created by passing a function as the first argument. Its value is derived from one or more dependencies (other ReactiveNodes). When any dependency changes, the computed node automatically recomputes its value.

Internally, ReactiveNode extends the RxJS `Subject`, which means it inherently supports:
- Emitting values (via `next()`)
- Error propagation (via `error()`)
- Completion notifications (via `complete()`)

This RxJS-based foundation ensures seamless integration with RxJS operators like `skip` and `take`, as well as compatibility with other RxJS-driven systems.

---

## 2. How ReactiveNode Leverages RxJS

### 2.1 Native RxJS Inheritance

Since ReactiveNode is built as an extension of RxJS’s Subject:
- **Subscription API:** It provides a `subscribe()` method that conforms to the standard RxJS subscription interface. This means any RxJS operator (e.g., `skip`, `take`, `pipe`) can be used directly on a ReactiveNode.
- **Error & Completion Handling:** With built-in support for error notification (using a dedicated ReplaySubject for dependency errors) and stream completion, ReactiveNode can be seamlessly integrated into reactive data flows.

### 2.2 Asynchronous Computations and Observables

ReactiveNode is capable of handling asynchronous data:
- **Observable Integration:** If a static node is initialized with an RxJS Observable, ReactiveNode subscribes to it internally and updates its value on every emission.
- **Async Computation:** Computed nodes can return either an Observable or a Promise. When an Observable is returned, the node subscribes to it; if a Promise is returned, it is resolved, and the value is updated accordingly.

### 2.3 Batch Updates

To avoid unnecessary recomputations when multiple updates occur in quick succession, ReactiveNode provides a static batching mechanism:
- **Batching Mode:** The static method `ReactiveNode.batch(fn)` wraps multiple updates, ensuring subscribers receive only the final computed value.
- **Immediate Updates:** If a node is configured with `disableBatching`, it bypasses this mechanism and recomputes immediately.

---

## 3. Using Dagify as a Svelte Store Replacement

Svelte stores require an object with a `subscribe` method, which ReactiveNode naturally provides by virtue of being an RxJS Subject. This means you can directly use a ReactiveNode in your Svelte components to manage state and computed values.

### Key Points:
- **Direct Subscription:** In Svelte, you can subscribe to a ReactiveNode just as you would with a Svelte store. The ReactiveNode’s `subscribe` method emits its current value and subsequent updates.
- **State Updates:** For stateful nodes, you can update values with `set(newValue)` or `update(fn)`. Computed nodes automatically update when their dependencies change.
- **Error Handling:** With integrated error notifications (using dependency error streams), you can react to errors in your reactive graph without interfering with the main data stream.

---

## 4. Code Examples

### 4.1 Creating a Stateful Node

```js
import { createNode } from 'dagify';

// Create a static node with an initial value of 0
const count = createNode(0);

// Update the node’s value
count.set(1);

// Use the RxJS subscription API
const unsubscribe = count.subscribe(value => {
  console.log("Count updated:", value);
});
```

### 4.2 Creating a Computed Node

```js
import { createNode } from 'dagify';

// Create a stateful node
const count = createNode(2);

// Create a computed node that doubles the count
const doubleCount = createNode((deps) => deps * 2, [count]);

// Subscribe to computed node updates
doubleCount.subscribe(value => {
  console.log("Double count:", value);
});

// When count is updated, doubleCount recomputes automatically
count.set(3); // Logs: Double count: 6
```

### 4.3 Integrating with Svelte Components

In your Svelte component, you can treat a ReactiveNode as a store:

[See example at svelte playground](https://svelte.dev/playground/1ef1e2c2f71a4738836a75ccd29464ef?version=5.20.4)

```svelte
<script>
  import { createNode } from 'dagify';

  // Create a stateful node
  const count = createNode(0);

  // Update count via user interaction
  function increment() {
    count.set(count.value + 1);
  }
</script>

<button on:click={increment}>
  Clicked {$count} times
</button>
```

Because ReactiveNode implements the standard `subscribe` method, the Svelte syntax for auto-subscription (i.e. the `$` prefix) works seamlessly.

---

## 5. Conclusion

Dagify’s ReactiveNode is a powerful, RxJS-based reactive primitive that not only provides advanced reactive dependency management but also fits perfectly as a replacement for Svelte stores. With built-in support for both synchronous and asynchronous updates, batching, and error handling, ReactiveNode can help simplify complex reactive state management while integrating seamlessly with existing RxJS-based systems.

By using Dagify in your applications, you gain a robust, composable, and scalable foundation for building reactive interfaces—whether you’re working with Svelte, RxJS, or other reactive frameworks.