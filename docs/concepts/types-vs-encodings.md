# Encodings vs. Types in ReactiveNode

In ReactiveNode, the concepts of **encodings** and **types** serve two distinct purposes. While they might seem similar at a glance, each addresses different concerns in the data lifecycle. This documentation explains the differences, their roles, and why we decided to separate them.

---

## Definitions

### Encodings

- **Purpose:**  
  Encodings handle the **serialization** and **deserialization** of node values. They transform values into a binary format (typically a Buffer) for storage or transmission and then convert them back to their original form when needed.

- **Examples:**
    - Converting an object to a JSON string and then to a Buffer (using a `"json"` encoding).
    - Encoding a string in UTF-8.
    - Converting numbers into a specific binary format, such as 8-bit unsigned integers.

- **When to Use:**  
  Use encodings when you need to persist node values, transmit them over a network, or perform other operations that require a compact binary representation of the data.

### Types

- **Purpose:**  
  Types are used for **validation** and **consistency**. They ensure that the values assigned to nodes conform to expected data formats or constraints. Type checking helps catch errors early by verifying that the value is of the correct primitive or structural type.

- **Examples:**
    - Ensuring that a value is a number, string, boolean, or a specific kind of object.
    - Validating that an integer is within a given range (e.g., int8, uint16).
    - Confirming that a value is a Buffer.

- **When to Use:**  
  Use type checking to enforce data integrity and correctness within your reactive graph. This is useful for debugging, preventing runtime errors, and maintaining predictable application behavior.

---

## Key Differences

### Primary Concern

- **Encodings:**  
  Focus on **how** data is stored and transferred. They transform the data into a standardized binary format.

- **Types:**  
  Focus on **what** the data is. They ensure the data meets certain criteria or formats.

### Use Case

- **Encodings:**  
  Are essential for **serialization** (e.g., saving to disk, sending over a network) and later **deserialization**. They don’t validate the data’s logical correctness but rather convert it between binary and object/string formats.

- **Types:**  
  Are essential for **data validation**. They ensure that values conform to expected types and ranges. This helps maintain consistency across the application and prevents errors due to type mismatches.

### Operation

- **Encodings:**  
  Work by converting values when they are **set** (encoded) and **retrieved** (decoded). They use helper functions (like `encodeValue` and `decodeValue`) to manage the binary representation.

- **Types:**  
  Work by applying a validator function (e.g., `typeof value === 'number'` or range checks) whenever a node’s value is assigned. If the value fails the validation, an error is raised or handled appropriately.

---

## Why Separate Encodings and Types

### Separation of Concerns

- **Different Responsibilities:**  
  Encodings and types address two different aspects of data handling:
    - **Encodings** are about **data representation** and **transport**.
    - **Types** are about **data correctness** and **validation**.

  By separating them, each module can focus on its specific responsibility without overlapping functionality.

### Flexibility and Extensibility

- **Independent Evolution:**  
  The encoding system can evolve to support new serialization formats (e.g., new binary protocols, compression methods) without affecting type checking. Similarly, the type system can be expanded or customized to enforce additional constraints without interfering with how data is encoded.

- **Customizability:**  
  Developers can register new types or new encoding formats independently. For example, you might add a custom type to validate a specific data structure while using the existing encoding mechanisms for serialization.

### Clearer Debugging and Error Handling

- **Isolated Error Sources:**  
  If an error occurs during encoding/decoding, you know it’s a serialization issue. If a value fails type validation, you know it’s due to data inconsistency. This clarity makes it easier to diagnose and fix issues.

---

## Example Scenarios

### Serialization Scenario

Imagine you need to persist a node’s value to a database. You configure the node with a `"json"` encoding. When you set the value, it gets converted into a JSON string and then into a Buffer. Later, when you retrieve the value, the Buffer is decoded back into an object.

- **Encoding Role:**  
  Converts the object to a binary format (Buffer) and back.

- **Type Role:**  
  If the node is also assigned a type (e.g., `"object"`), the system verifies that the decoded value is a valid object.

### Validation Scenario

Suppose you have a node that should always hold a non-negative integer. You assign it the type `"uint"`. Regardless of any serialization logic, when you set a value, the type system validates that the value is an integer greater than or equal to zero.

- **Type Role:**  
  Ensures the value is valid and within the expected range.

- **Encoding Role (if enabled):**  
  If you also set an encoding, that encoding will handle serialization, but the type check remains independent.

---

## Summary

- **Encodings** convert data into a binary format for storage or transmission. They operate during value setting and retrieval, ensuring data is properly serialized and deserialized.
- **Types** validate the actual content of data to ensure it matches expected formats and constraints, helping maintain data integrity.
- **Separation Benefits:**
    - Clear separation of responsibilities.
    - Independent evolution and extensibility.
    - Better debugging and error identification.

This separation allows ReactiveNode to efficiently manage data representation and integrity without conflating two distinct concerns.