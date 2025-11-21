## Examples & Recipes

Short, copy-pastable scenarios. For fuller runnable samples see the files in `examples/` (e.g., `neuralNetwork.js`, `SvelteExample.svelte`).

### ⚡ 0. FRP Pipeline (Event Processing)

```js
import { createStore, map, filter, merge, from } from "dagify";

const clicks = createStore(0);
const apiResponses$ = from(fetch("/api/status")); // wraps a promise as a node

const doubledClicks = map(clicks, n => n * 2);
const evenClicks = filter(doubledClicks, n => n % 2 === 0);
const feed = merge([evenClicks, apiResponses$]);

feed.stream.subscribe(value => console.log("Pipeline emission:", value));

clicks.set(1); // filtered out
clicks.set(2); // emits 4
```

---

### 🔗 1. Complex State Management (Financial Dashboard)

```js
// Create stateful nodes for price and threshold.
const price = createNode(100);
const threshold = createNode(150);

// Create a computed node that checks if the price exceeds the threshold.
// The computation function receives an array [price, threshold] from its dependencies.
const alert = createNode(
  ([currentPrice, currentThreshold]) => currentPrice > currentThreshold,
  [price, threshold]
);

// Subscribe to the alert node. When the computed value is true, trigger an alert.
alert.subscribe(isOver => {
  if (isOver) console.log("Price threshold reached!");
});

// Simulate a price change.
price.set(160); // Logs: "Price threshold reached!"
```

---

### 🎨 2. Visual Node-Based Editor (Workflow Automation)

```js
// A node representing the completion of a data fetch.
const fetchData = createNode("Data fetched");

// A computed node that processes the fetched data.
const processData = createNode(
  ([data]) => `${data} processed`,
  [fetchData]
);

// A computed node that represents sending an email with the processed data.
const sendEmail = createNode(
  ([processedData]) => `Email sent with: ${processedData}`,
  [processData]
);

// Subscribe to the sendEmail node to log the final output.
sendEmail.subscribe(console.log); 
// Logs: "Email sent with: Data fetched processed"
```

---

### 🔄 3. Reactive Command Dispatch System

```js
// A stateful node representing user input.
const userInput = createNode("initial input");

// A computed node that validates the user input (e.g., checking input length).
const validateInput = createNode(
  ([input]) => input.length > 5,
  [userInput]
);

// A computed node that dispatches a command based on the user input and its validation.
const dispatchCommand = createNode(
  ([input, isValid]) => isValid ? `Command sent: ${input}` : "Validation failed",
  [userInput, validateInput]
);

// Subscribe to the dispatchCommand node to see the command result.
dispatchCommand.subscribe(console.log);

userInput.set("short");        // Logs: "Validation failed"
userInput.set("long enough");  // Logs: "Command sent: long enough"
```

---

### ⚛️ 4. Reactive UI Component State

```js
// A stateful node representing a counter.
const counter = createNode(0);

// A computed node that doubles the counter's value.
const doubleCounter = createNode(
  ([count]) => count * 2,
  [counter]
);

// Subscribe to doubleCounter to log updates.
doubleCounter.subscribe(value => console.log(`Double count: ${value}`));

counter.set(1); // Logs: "Double count: 2"
counter.set(5); // Logs: "Double count: 10"
```

---

### 🗂️ 5. Data Transformation Pipeline (IoT Data Stream)

```js
// A stateful node with raw data.
const rawData = createNode([1, 2, 3]);

// A computed node that filters the raw data.
const filteredData = createNode(
  ([data]) => data.filter(n => n > 1),
  [rawData]
);

// A computed node that sums the filtered data.
const sumData = createNode(
  ([filtered]) => filtered.reduce((sum, n) => sum + n, 0),
  [filteredData]
);

// Subscribe to sumData to log the result.
sumData.subscribe(sum => console.log(`Sum of filtered data: ${sum}`));

rawData.set([2, 3, 4]); // Logs: "Sum of filtered data: 9"
```

---

### 📈 6. Reactive Form Validation

```js
// Stateful nodes for form fields.
const email = createNode("");
const password = createNode("");

// A computed node that determines if the form is valid.
const isFormValid = createNode(
  ([emailValue, passwordValue]) => emailValue.includes("@") && passwordValue.length >= 6,
  [email, password]
);

// Subscribe to log the validation state.
isFormValid.subscribe(valid => console.log(`Form valid: ${valid}`));

email.set("test@example.com");
password.set("123456"); // Logs: "Form valid: true"
```

---

### 🧮 7. Computation Caching System

```js
// Stateful nodes for base value and multiplier.
const baseValue = createNode(10);
const multiplier = createNode(2);

// A computed node that multiplies the base value by the multiplier.
const result = createNode(
  ([base, mult]) => base * mult,
  [baseValue, multiplier]
);

// Subscribe to log the computed result.
result.subscribe(res => console.log(`Result: ${res}`));

multiplier.set(5); // Logs: "Result: 50"
```

---

### 🔐 8. Access Control System (RBAC Example)

```js
// A stateful node representing a user's role.
const userRole = createNode("user");

// A computed node that derives permissions based on the userRole.
const permissions = createNode(
  ([role]) => {
    if (role === "admin") return ["read", "write", "delete"];
    if (role === "editor") return ["read", "write"];
    return ["read"];
  },
  [userRole]
);

// Subscribe to log permission changes.
permissions.subscribe(perms => console.log(`Permissions: ${perms.join(", ")}`));

userRole.set("editor"); // Logs: "Permissions: read, write"
userRole.set("admin");  // Logs: "Permissions: read, write, delete"
```

---

### 🤖 9. Agentic Tool Orchestration (Commands + Bridge)

```js
import { createNode } from "dagify";
import { command, bridge, dispatcher } from "dagify/effect";

const request = createNode(null);
const response = createNode(([payload]) => {
  // Pure processing of the request
  return { ok: true, id: payload.id, result: payload.input.toUpperCase() };
}, [request]);

// Bridge lets external agents write requests and await processed responses.
const tool = bridge(request, response);

// Command for side effects (e.g., logging to a service) with burst-friendly batching.
const logCommand = command("@log", payload => {
  console.log("LOG", payload);
  return { logged: true };
}, { disableBatching: false });

tool.subscribe(result => {
  // Downstream consumers see processed responses
  console.log("TOOL RESULT", result);
});

await tool.set({ id: "task-1", input: "hello" }); // emits processed response
dispatcher.next({ commandName: "@log", payload: { task: "task-1" } }); // triggers command node
```
