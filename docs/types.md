# Types & Type Checking in ReactiveNode

The **types** system provides a flexible way to validate node values. Each node can be assigned a specific type, and the system ensures that the values conform to the expected type. This is especially useful for catching errors early and ensuring consistency throughout your reactive graph.

---

## Overview

ReactiveNode uses a global **TypeRegistry** that stores a set of type validators. These validators are functions that return a truthy value if the input value is valid for that type, and a falsy value otherwise.

The public API exposes a singleton called **`types`** which is an instance of `TypeRegistry`. This registry is preloaded with a set of default types.

### Public API

```js
import { types } from "dagify/internal/types";
```

The default types are automatically registered using the `includeDefaultTypes` function.

---

## Default Types

The following types are included by default. Each type has a corresponding validator function:

### Basic Types

- **`any`**  
  _Validator:_ Always returns true.  
  _Usage:_ Accepts any value.

- **`number`**  
  _Validator:_ Checks that the value is of type `number`.

- **`string`**  
  _Validator:_ Checks that the value is of type `string`.

- **`boolean`**  
  _Validator:_ Checks that the value is of type `boolean`.

- **`object`**  
  _Validator:_ Accepts non-null objects that are not arrays.

- **`array`**  
  _Validator:_ Uses `Array.isArray` to validate arrays.

- **`function`**  
  _Validator:_ Checks that the value is a function.

### Integer Types

- **`int`**  
  _Validator:_ Uses `Number.isInteger` to ensure the value is an integer.

- **`uint`**  
  _Validator:_ Checks that the value is a non-negative integer.

- **`int8` / `uint8`**  
  _Validators:_
    - `int8`: Ensures the value is an integer between -128 and 127.
    - `uint8`: Ensures the value is an integer between 0 and 255.

- **`int16` / `uint16`**  
  _Validators:_
    - `int16`: Validates integer in the range -32768 to 32767.
    - `uint16`: Validates integer in the range 0 to 65535.

- **`int32` / `uint32`**  
  _Validators:_
    - `int32`: Validates integer in the range -2147483648 to 2147483647.
    - `uint32`: Validates integer in the range 0 to 4294967295.

- **`int64` / `uint64`**  
  _Validators:_
    - `int64`: Accepts either a `bigint` or a safe integer within the range of 64-bit signed integers.
    - `uint64`: Accepts either a `bigint` or a non-negative integer (limited by JavaScript's `Number.MAX_SAFE_INTEGER`).

### Floating Point Types

- **`float32`**  
  _Validator:_ Checks that the value is a number and that converting it via `Math.fround` doesn’t change it.

- **`float64`**  
  _Validator:_ Accepts any JavaScript number (all numbers are essentially float64).

### Binary Types

- **`buffer`**  
  _Validator:_ Uses a buffer utility (e.g. from `b4a`) to check if the value is a Buffer.

- **`binary`**  
  _Alias:_ An alias for the `buffer` type.

---

## Registering Custom Types

You can extend the type registry by registering additional types. This is done via the `registerType` method on the **`types`** instance.

### Example

```js
// Define a validator for an email string.
const emailValidator = value => typeof value === 'string' && /\S+@\S+\.\S+/.test(value);

// Register the custom type.
types.registerType('email', emailValidator);

// Now, you can assign a node with type "email":
import { createNode } from "./lib/node/index.js";

const emailNode = createNode("test@example.com", null, { type: "email" });
```

---

## How It Works in ReactiveNode

When you create a node, you can specify the expected type via the node configuration (using the `type` property). Before a node’s value is set or updated, the value is validated against the corresponding validator from the **`types`** registry.

If the value does not pass validation, the node will typically trigger an error, helping you catch type mismatches early in your reactive graph.

---

## Summary

- **Types System:**  
  Provides validators for ensuring node values meet expected criteria.

- **Default Types:**  
  Includes basic types (any, number, string, etc.), various integer types (int8, uint8, etc.), floating-point types (float32, float64), and binary types (buffer, binary).

- **Extensibility:**  
  Use `types.registerType` to add custom types, such as an email validator.

- **Usage in Nodes:**  
  When a node is created with a specified type (via `type` in the config), its value is validated automatically. If the value does not match the expected type, type checking errors are raised.

This system provides a robust and flexible way to ensure data consistency and integrity across your reactive nodes.

Below is the updated documentation that includes a note about the singleton used by dagify, as well as an example of how to integrate default types and utility functions for setting and getting types.

---

# TypeRegistry Documentation

The `TypeRegistry` class provides a simple mechanism to register type validators and combine them into complex validators using union or intersection operations. Validators are functions that determine whether a given value meets the criteria for a type by returning `true` or `false`.

Dagify creates a singleton instance under the variable `types` that is used globally to collect all registered types. This allows the entire application to share a common type registry.

---

## Overview

- **Purpose:**  
  Manage and combine type validators in a centralized registry.

- **Key Features:**
    - Register custom type validators.
    - Retrieve and check if a type is registered.
    - Create union validators where a value is valid if it meets at least one type.
    - Create intersection validators where a value is valid only if it meets all types.
    - Define new composite types based on custom validator logic.
    - Support a singleton (`types`) for global access throughout the application (used in dagify).

---

## Class: `TypeRegistry`

### Properties

- **`types`**:  
  A `Map` that stores type names as keys and their corresponding validator functions as values.

---

## Methods

### `constructor()`

Creates a new instance of the `TypeRegistry` and initializes an empty `Map` for storing types.

---

### `registerType(name, validator)`

Registers a new type with a unique name and its validator function.

- **Parameters:**
    - `name` (`string`): A unique name for the type.
    - `validator` (`Function`): A function that takes a value as input and returns `true` if the value is valid for the type, or `false` otherwise.

- **Throws:**
    - An `Error` if a type with the same name has already been registered.

- **Example:**
  ```js
  const registry = new TypeRegistry();
  registry.registerType("number", value => typeof value === "number");
  ```

---

### `getType(name)`

Retrieves the validator function for a registered type.

- **Parameters:**
    - `name` (`string`): The name of the registered type.

- **Returns:**
    - `Function`: The validator function for the specified type.
    - If the type is not found, it returns `undefined`.

- **Example:**
  ```js
  const numberValidator = registry.getType("number");
  if (numberValidator) {
    console.log(numberValidator(42)); // true
  }
  ```

---

### `hasType(name)`

Checks whether a type is registered in the registry.

- **Parameters:**
    - `name` (`string`): The name of the type.

- **Returns:**
    - `boolean`: `true` if the type exists, `false` otherwise.

- **Example:**
  ```js
  console.log(registry.hasType("number")); // true or false
  ```

---

### `union(...typeNames)`

Creates a union type validator from multiple registered types. The union validator returns `true` if the value satisfies **at least one** of the specified validators.

- **Parameters:**
    - `...typeNames` (`string`): One or more type names to combine.

- **Returns:**
    - `Function`: A new validator function for the union type.

- **Throws:**
    - An `Error` if any of the provided type names are not registered.

- **Example:**
  ```js
  registry.registerType("string", value => typeof value === "string");
  const stringOrNumber = registry.union("string", "number");
  console.log(stringOrNumber("hello")); // true
  console.log(stringOrNumber(100));     // true
  console.log(stringOrNumber({}));      // false
  ```

---

### `intersection(...typeNames)`

Creates an intersection type validator from multiple registered types. The intersection validator returns `true` only if the value satisfies **all** of the specified validators.

- **Parameters:**
    - `...typeNames` (`string`): One or more type names to combine.

- **Returns:**
    - `Function`: A new validator function for the intersection type.

- **Throws:**
    - An `Error` if any of the provided type names are not registered.

- **Example:**
  ```js
  // Assume a custom intersection requirement where a value must be both a number and positive
  registry.registerType("positive", value => typeof value === "number" && value > 0);
  const positiveNumber = registry.intersection("number", "positive");
  console.log(positiveNumber(10));   // true
  console.log(positiveNumber(-10));  // false
  console.log(positiveNumber("10")); // false
  ```

---

### `createType(name, validator)`

A helper method to create and register a new type validator that might be a combination or a custom validator.

- **Parameters:**
    - `name` (`string`): The unique name for the new type.
    - `validator` (`Function`): A custom validator function that defines the type.

- **Behavior:**
    - Internally calls `registerType` to add the new type to the registry.

- **Example:**
  ```js
  // Create a new type that validates if a value is an even number
  registry.createType("evenNumber", value => typeof value === "number" && value % 2 === 0);
  console.log(registry.getType("evenNumber")(4)); // true
  console.log(registry.getType("evenNumber")(5)); // false
  ```

---

## Global Integration Example

The following snippet demonstrates how dagify creates a global singleton instance of `TypeRegistry` under the variable `types`, registers default types, and provides utility functions to set and get types on nodes:

```js
import {TypeRegistry} from "./TypeRegistry.js";
import {includeDefaultTypes} from "./defaultTypes.js";

// Create a global singleton for types
const types = new TypeRegistry();

// Register a universal 'any' type that accepts any value
types.registerType('any', () => true);

// Include default types into the registry
includeDefaultTypes(types);

/**
 * Sets the type for a given node.
 * If the provided type is a function, it is executed with the global types registry.
 *
 * @param {Object} node - The node to set the type for.
 * @param {string|Function} type - The type name or a function returning a type.
 * @returns {Object} The updated node.
 */
const setType = (node, type) => {
    if (typeof type === "function") {
        type = type(types);
    }
    node.type = type;
    return node;
}

/**
 * Retrieves the type of a given node.
 * Defaults to the 'any' type if no type is set.
 *
 * @param {Object} node - The node from which to retrieve the type.
 * @returns {string|Function} The type of the node.
 */
const getType = (node) => {
    return node.type || types.getType("any");
}

export { types, setType, getType };
export { encodeValue, decodeValue };
```

**Key Points:**

- **Singleton Instance:**  
  Dagify uses the singleton instance `types` to register and manage all global type validators. This ensures a consistent type registry across the entire application.

- **Default Types:**  
  The example registers a default type `any` (which always returns `true`), then incorporates additional default types via the `includeDefaultTypes` function.

- **Utility Functions:**
    - `setType(node, type)`: Sets the type on a node. If `type` is a function, it executes the function with the global registry to determine the type.
    - `getType(node)`: Retrieves the type from a node. If no type is set, it defaults to the `any` type from the global registry.

---

## Conclusion

The `TypeRegistry` class and the singleton implementation in dagify provide a robust and flexible framework for type validation. By centralizing type definitions and enabling composite validations through union and intersection operations, developers can build modular and scalable validation logic for their applications. The global singleton `types` simplifies managing types across different parts of the system, ensuring consistency and reusability of validation logic.
