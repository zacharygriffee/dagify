Here are simple examples for each use case to illustrate how Dagify could be applied in different scenarios:

---

### 🔗 1. Complex State Management (Financial Dashboard)

```js
const price = createNode(100);
const threshold = createNode(150);
const alert = createNode(() => price.value > threshold.value);

// Subscribe to trigger alerts
alert.subscribe(value => {
  if (value) console.log("Price threshold reached!");
});

// Simulate price change
price.set(160); // Logs: "Price threshold reached!"
```

---

### 🎨 2. Visual Node-Based Editor (Workflow Automation)

```js
const fetchData = createNode("Data fetched");
const processData = createNode(() => `${fetchData.value} processed`);
const sendEmail = createNode(() => `Email sent with: ${processData.value}`);

// Subscriptions for action completion
sendEmail.subscribe(console.log); // Logs: "Email sent with: Data fetched processed"
```

---

### 🔄 3. Reactive Command Dispatch System

```js
const userInput = createNode("initial input");
const validateInput = createNode(() => userInput.value.length > 5);
const dispatchCommand = createNode(() => {
  if (validateInput.value) return `Command sent: ${userInput.value}`;
  return "Validation failed";
});

// Subscribing to command execution
dispatchCommand.subscribe(console.log);

userInput.set("short");        // Logs: "Validation failed"
userInput.set("long enough");  // Logs: "Command sent: long enough"
```

---

### ⚛️ 4. Reactive UI Component State

```js
const counter = createNode(0);
const doubleCounter = createNode(() => counter.value * 2);

// Simulate component reaction
doubleCounter.subscribe(value => console.log(`Double count: ${value}`));

counter.set(1); // Logs: "Double count: 2"
counter.set(5); // Logs: "Double count: 10"
```

---

### 🗂️ 5. Data Transformation Pipeline (IoT Data Stream)

```js
const rawData = createNode([1, 2, 3]);
const filteredData = createNode(() => rawData.value.filter(n => n > 1));
const sumData = createNode(() => filteredData.value.reduce((a, b) => a + b, 0));

// Reactive output
sumData.subscribe(sum => console.log(`Sum of filtered data: ${sum}`));

rawData.set([2, 3, 4]); // Logs: "Sum of filtered data: 9"
```

---

### 📈 6. Reactive Form Validation

```js
const email = createNode("");
const password = createNode("");
const isFormValid = createNode(() => email.value.includes("@") && password.value.length >= 6);

// React to form validation state
isFormValid.subscribe(valid => console.log(`Form valid: ${valid}`));

email.set("test@example.com");
password.set("123456"); // Logs: "Form valid: true"
```

---

### 🧮 7. Computation Caching System

```js
const baseValue = createNode(10);
const multiplier = createNode(2);
const result = createNode(() => baseValue.value * multiplier.value);

// React to changes efficiently
result.subscribe(res => console.log(`Result: ${res}`));

multiplier.set(5); // Logs: "Result: 50"
```

---

### 🔐 8. Access Control System (RBAC Example)

```js
const userRole = createNode("user");
const permissions = createNode(() => {
  if (userRole.value === "admin") return ["read", "write", "delete"];
  if (userRole.value === "editor") return ["read", "write"];
  return ["read"];
});

// Log permission changes reactively
permissions.subscribe(perms => console.log(`Permissions: ${perms.join(", ")}`));

userRole.set("editor"); // Logs: "Permissions: read, write"
userRole.set("admin");  // Logs: "Permissions: read, write, delete"
```

---

These examples focus on showing reactivity and dependency management in simple terms, using `createNode`, `set`, and subscriptions to reflect updates.