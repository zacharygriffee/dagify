# Dagify Activity-Thresholding API Documentation

This section describes the neuron-inspired update aggregation mechanism that you can enable in your ReactiveNode by setting `enableActivityThresholding`. This mechanism aggregates updates (via `visit()`) and only triggers a recomputation once a defined threshold is reached. It also includes a decay mechanism to gradually reduce the update count when the node is inactive.

---

## Configuration Options

When creating a new `ReactiveNode`, you can pass the following configuration options related to activity thresholding:

- **`enableActivityThresholding`**  
  Type: `boolean`  
  Default: `false`  
  Description: If set to `true`, the node will use the activity thresholding mechanism rather than immediately computing on every dependency update.

- **`activationThreshold`:**  
  Type: `number`  
  Default: `5`  
  Description: The number of times the node must be "visited" (via the `visit()` method) before it "fires" (triggers a recomputation).

- **`decayInterval`:**  
  Type: `number` (milliseconds)  
  Default: `1000`  
  Description: The interval at which the node’s activity level is decremented if no updates occur. This prevents inactive nodes from maintaining a high update count.

---

## Key Methods

### `visit()`

**Signature:**
```js
visit(): void
```

**Description:**  
This method is called to "register" an update or activity on the node. Each call to `visit()` increments the node’s internal `activityLevel` and updates the `lastVisited` timestamp. Once the `activityLevel` reaches the `activationThreshold`, the node triggers a computation (by calling `compute()`) and then resets the `activityLevel` to 0.

**Usage Example:**
```js
// Assume sensorDataNode is a ReactiveNode with activity thresholding enabled.
sensorDataNode.visit(); // Called on each sensor update.
```
---
**Important:**
When using the activity thresholding mechanism (enabled via enableActivityThresholding), note that each node sets up an internal decay timer (using setInterval) to decrement its activity level over time. This timer will keep running until the node is explicitly cleaned up.
Recommendation:
Call the node’s complete() method (or an equivalent cleanup function) when the node is no longer needed. This ensures that the internal timer is cleared and prevents the process from hanging due to lingering timers.
---

### `startDecay()`

**Signature:**
```js
startDecay(): void
```

**Description:**  
This method sets up an interval timer (using `setInterval`) to decrement the node's `activityLevel` if it has not been "visited" within the specified `decayInterval`. This decay helps prevent outdated or sporadic activity from keeping the node in a high-priority state indefinitely.

**Usage:**  
The method is automatically called during node initialization if activity thresholding is enabled.
---
**Important:**
When using the activity thresholding mechanism, note that each node sets up an internal decay timer (using setInterval) to decrement its activity level over time. This timer will keep running until the node is explicitly cleaned up.
Recommendation:
Call the node’s complete() method (or an equivalent cleanup function) when the node is no longer needed. This ensures that the internal timer is cleared and prevents the process from hanging due to lingering timers.

---

## Example Usage

Below is an example showing how to enable activity thresholding on a node and how it aggregates updates before triggering an expensive computation:

```js
import {ReactiveNode} from './ReactiveNode';

// Create a computed node with activity thresholding enabled
const sensorDataNode = new ReactiveNode(() => {
    // Expensive computation combining multiple sensor inputs
    return computeHeavyAggregation();
}, [sensor1Node, sensor2Node, sensor3Node], {
    enableActivityThresholding: true,       // Enable activity thresholding
    activationThreshold: 3,           // Node will compute after 3 visits
    decayInterval: 1000               // Activity decays every 1000ms
});

// Simulate sensor updates calling `visit()`
setInterval(() => {
    // Each update "visits" the node, aggregating multiple small changes
    sensorDataNode.visit();
}, 300);

// Subscribe to see when the computation fires
sensorDataNode.subscribe(newValue => {
    console.log("Aggregated sensor data updated:", newValue);
});
```

In this example:
- The node aggregates visits from sensor updates.
- When `visit()` has been called 3 times (as specified by `activationThreshold`), the node computes a new value.
- The `startDecay()` mechanism ensures that if sensor updates slow or stop, the activity level gradually decays.

---

## Summary

The activity thresholding mechanism (enabled via `enableActivityThresholding`) helps balance performance by:
- **Aggregating Updates:** The node waits until sufficient activity has accumulated before triggering a costly computation.
- **Preventing Noise:** The decay mechanism prevents sporadic updates from unnecessarily triggering computations.
- **Configurable Behavior:** Parameters such as `activationThreshold` and `decayInterval` let you fine-tune the behavior based on your application needs.
