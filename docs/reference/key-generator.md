### Overview

This module provides a simple mechanism for managing key generators. A key generator is a function that produces keys (for example, unique IDs) and **must return a key as a 32 byte buffer**. The module imports a default key generator and allows users to register additional, custom key generators. It also provides functions to switch the active generator globally or temporarily during a specific operation.

---

### Module Components

#### 1. **Importing the Default Generator**

```javascript
import { defaultKeyGenerator } from "dagify/internal/key-management";
```

- **defaultKeyGenerator:**  
  The default function used to generate keys. It is imported from a separate module and is used as the fallback if no custom generator is specified.  
  **Important:** This generator function must return a key that is a 32 byte buffer.

---

#### 2. **Internal State**

```javascript
const keyGenerator = new Map();
```

- **keyGenerator (Map):**  
  A private `Map` that stores custom key generators. Each generator is stored with an associated name, making it easy to reference and switch between them.  
  **Note:** All custom key generator functions stored in this map must return a key that is a 32 byte buffer.

---

#### 3. **Exported Variables and Functions**

##### **a. currentKeyGenerator**

```javascript
export let currentKeyGenerator = defaultKeyGenerator;
```

- **currentKeyGenerator:**  
  An exported variable that holds the currently active key generator. By default, it is initialized to `defaultKeyGenerator`.  
  **Important:** The active key generator function must always return a key that is a 32 byte buffer.

---

##### **b. registerKeyGenerator**

```javascript
export const registerKeyGenerator = (name, generator) => {
    keyGenerator.set(name, generator);
}
```

- **Purpose:**  
  To allow users to register a custom key generator function.

- **Parameters:**
    - `name` (string): A unique identifier for the key generator.
    - `generator` (function): The key generator function that produces keys.

- **Usage Example:**

  ```javascript
  // Register a custom key generator named "uuidGenerator"
  registerKeyGenerator("uuidGenerator", () => {
      // Returns a key as a 32 byte buffer
      return Buffer.alloc(32);
  });
  ```

  **Note:** The provided generator must return a key that is a 32 byte buffer.

---

##### **c. useKeyGenerator**

```javascript
export const useKeyGenerator = (name) => {
    currentKeyGenerator = name ? keyGenerator.get(name) : defaultKeyGenerator;
}
```

- **Purpose:**  
  To switch the active key generator to a custom one based on its registered name.

- **Parameters:**
    - `name` (string, optional): The name of the registered key generator to activate.

- **Behavior:**
    - If a `name` is provided and exists in the map, `currentKeyGenerator` is set to that generator.
    - If no name is provided or if the provided name is falsy, `currentKeyGenerator` resets to the default.

- **Usage Example:**

  ```javascript
  // Switch to the custom generator "uuidGenerator"
  useKeyGenerator("uuidGenerator");
  
  // currentKeyGenerator now references the "uuidGenerator" function.
  console.log(currentKeyGenerator());
  ```

  **Important:** The active generator, whether custom or default, must return a key that is a 32 byte buffer.

---

##### **d. useKeyGeneratorWhile**

```javascript
export const useKeyGeneratorWhile = (name, cb) => {
    const old = currentKeyGenerator;
    useKeyGenerator(name);
    cb();
    currentKeyGenerator = old;
}
```

- **Purpose:**  
  To temporarily switch the active key generator while executing a specific callback.

- **Parameters:**
    - `name` (string): The name of the key generator to use during the callback.
    - `cb` (function): A callback function that will be executed while the custom key generator is active.

- **Behavior:**
    - Saves the current key generator to a temporary variable (`old`).
    - Switches the active generator to the one specified by `name` using `useKeyGenerator(name)`.
    - Executes the callback function `cb()`, during which any key generation will use the new generator.
    - After the callback completes, it restores the original key generator.

- **Usage Example:**

  ```javascript
  // Temporarily use "uuidGenerator" for a specific operation
  useKeyGeneratorWhile("uuidGenerator", () => {
      // Within this block, currentKeyGenerator uses "uuidGenerator"
      console.log(currentKeyGenerator());
  });
  // After execution, currentKeyGenerator reverts to its previous value.
  ```

  **Note:** Even when used temporarily, the key generator must produce a 32 byte buffer.
