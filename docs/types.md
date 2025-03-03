# Types & Type Checking in ReactiveNode

The **types** system provides a flexible way to validate node values. Each node can be assigned a specific type, and the system ensures that the values conform to the expected type. This is especially useful for catching errors early and ensuring consistency throughout your reactive graph.

---

## Overview

ReactiveNode uses a global **TypeRegistry** that stores a set of type validators. These validators are functions that return a truthy value if the input value is valid for that type, and a falsy value otherwise.

The public API exposes a singleton called **`types`** which is an instance of `TypeRegistry`. This registry is preloaded with a set of default types.

### Public API

```js
import { types } from "./lib/types/index.js";
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