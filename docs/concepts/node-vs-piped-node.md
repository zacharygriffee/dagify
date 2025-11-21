# Comparing a ReactiveNode and Its Piped Version

In Dagify (or similar reactive systems), a **ReactiveNode** is more than just an RxJS Observable. It encapsulates its own lifecycle, dependencies, subscription management, and even custom hooks (such as `finalize`, `onSubscribe`, and `onUnsubscribe`). When you use a ReactiveNode directly, you have full control over its API, including:

- **Lifecycle Control:**
    - You can trigger explicit updates via `compute()` or `update()`.
    - You have hooks for cleanup and finalization (`finalize`/`onCleanup`).
    - You can manage dependencies and observe the node’s complete error and complete notifications.

- **Subscription Management:**
    - You can directly subscribe to the node.
    - You have access to its subscriber count (via the hooks) and can trigger dependency cleanup when no subscribers remain.

- **Additional Methods:**
    - Methods like `setDependencies`, `addDependency`, and `removeDependency` are only available on the node itself.
    - You can call custom methods or inspect properties like `id`, `key`, `value`, etc.

---

## What Happens When You Pipe a Node?

When you call:

```js
const piped$ = node.pipe(
  map(val => val * 2),
  filter(val => val > 10)
);
```

the following occurs:

- **Transformation of the Stream:**  
  The `pipe(...)` operator creates a new RxJS Observable that applies the given operators to the emissions from `node`.

- **Loss of Node-Specific Methods:**  
  While `piped$` is still an observable, it **no longer has the full interface of a ReactiveNode**. That means:
    - You cannot call `compute()`, `update()`, or any dependency-related methods on `piped$`.
    - Lifecycle hooks (like `finalize` or `onUnsubscribe`) attached to the original node will still run as designed—but you lose direct access to them.
    - You cannot easily retrieve the node’s metadata (e.g., `id`, `key`, etc.) or custom methods after piping.

- **Limited Control over Subscriptions:**  
  With the original node, you can track subscriber counts and respond when the node’s state changes (for instance, cleaning up dependencies when no subscribers remain). With a piped observable, you only have the standard RxJS subscription API:
    - No direct access to hooks like `onSubscribe` or `onUnsubscribe`.
    - You are only notified about data values, errors, or completions; any custom logic inside the node is not directly exposed.

- **Loss of Custom Behavior:**  
  Any custom behavior defined on the ReactiveNode (e.g., updating dependent state, error handling beyond the standard RxJS mechanisms, or integration with Dagify’s dependency graph) is abstracted away. The piped observable behaves like a standard stream, so you cannot, for instance, trigger a re-computation or modify dependency management on the fly.

---

## Summary

| Feature / Control         | ReactiveNode Reference              | Piped Version (node.pipe(...))         |
|---------------------------|-------------------------------------|----------------------------------------|
| **Lifecycle Methods**     | Full access (`compute()`, `update()`, etc.) | Not available – only standard Observable API |
| **Custom Hooks**          | `finalize`, `onSubscribe`, `onUnsubscribe` accessible and customizable | Hidden inside the node; cannot be invoked directly |
| **Dependency Management** | Methods like `setDependencies`, `addDependency`, etc. are available | Lost – only the transformed stream is accessible |
| **Metadata Access**       | Properties such as `id`, `key`, etc. | Not exposed in the piped observable |
| **Subscription Control**  | Subscriber count and cleanup logic directly managed | Only standard RxJS subscription control is available |

**Conclusion:**  
Using the piped version of a ReactiveNode is ideal when you want to apply RxJS operators to transform the data stream for consumption (e.g., in a UI component or a logging mechanism). However, if you need to maintain full control over the node’s lifecycle, dependency management, or if you require access to custom hooks and metadata, you should keep a reference to the original node before piping.

**Full Example of Maintaining Control**

Below is an example illustrating how to maintain full control over a ReactiveNode while still taking advantage of RxJS piping. In this approach, you store a reference to the original node and then create a piped observable from it. This lets you update, inspect, and manage the node’s lifecycle, while also applying operators on its stream for downstream consumption.

```js
// Create the node and store the reference.
const node = createNode(initialValue, dependencies, {
  disableBatching: false,
  finalize: (err) => {
    if (err) {
      console.error('Node finalized with error:', err);
    } else {
      console.log('Node finalized normally.');
    }
  },
  onSubscribe: (count) => {
    console.log(`Node subscribed, total subscribers: ${count}`);
  },
  onUnsubscribe: (count) => {
    console.log(`Node unsubscribed, remaining subscribers: ${count}`);
  }
});

// Create a piped observable from the node for downstream processing.
const nodePiped = node.pipe(
  // For example, double each emitted value.
  map(val => val * 2),
  // Only pass through values greater than 10.
  filter(val => val > 10)
);

// Use the piped observable in your application, for example in a component.
nodePiped.subscribe({
  next: (value) => console.log('Piped value:', value),
  error: (err) => console.error('Piped error:', err),
  complete: () => console.log('Piped complete.')
});

// Meanwhile, you can still control and update the original node.
node.update(newValue);
node.compute();
// Access metadata if needed:
console.log('Node ID:', node.id);
```

### Explanation

- **Maintaining the Node Reference:**  
  By storing the node in a variable (`node`), you keep full access to its methods (e.g., `update()`, `compute()`, etc.) and lifecycle hooks (like `finalize`, `onSubscribe`, `onUnsubscribe`).

- **Creating a Piped Observable:**  
  The `nodePiped` observable is created via `node.pipe(...)`. This stream transforms the node’s emitted values without losing the underlying node's control.

- **Using Both Together:**  
  You can use `nodePiped` to drive UI components or downstream processing, while still having the ability to update the node or check its status via the original reference.

This pattern gives you the best of both worlds: the enhanced capabilities and lifecycle control of a ReactiveNode, plus the flexibility of RxJS operators for data transformation.
