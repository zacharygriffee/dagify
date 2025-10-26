# Encoding in ReactiveNode

ReactiveNode supports flexible encoding/decoding of node values to enable reliable serialization and deserialization. By configuring a node with a specific encoding, you can ensure that values are stored in a standardized binary format (typically a Buffer) and decoded back into their original form when accessed. This documentation covers the available encodings, how to construct the encoding string, and how the encoder is determined.

---

## Overview

- **Purpose:**  
  Encoding is used to serialize node values into binary form so they can be stored or transmitted. When a node is configured with a specific encoding (i.e. a value other than the default `"any"`), it automatically encodes the value on set and decodes it on get. Dagify exposes encoding helpers from the internal namespace (`dagify/internal/encoding`).

- **Default Behavior:**  
  If no specific encoding is provided or if `"any"` is specified, the node does not perform any encoding or decoding and works directly with the raw value.

---

## Available Encodings

The encoding system leverages the [compact-encoding](https://github.com/mafintosh/compact-encoding) library. This library provides a range of built-in encoders for common data types, including:

- **Raw Encodings:**
    - `raw.utf8` – Encodes strings in UTF-8.
    - `raw.ascii` – Encodes strings in ASCII.
    - `raw.hex` – Encodes buffers as hexadecimal strings.
    - `raw.base64` – Encodes buffers as Base64.
    - `raw.ucs2` or `raw.utf16le` – Encodes strings in UTF-16 little-endian.

- **Numeric Encodings:**
    - `uint`, `uint8`, `uint16`, `uint24`, `uint32` – For unsigned integers.
    - `int`, `int8`, `int16`, `int24`, `int32` – For signed integers using ZigZag encoding.
    - `float32` and `float64` – For floating point numbers.
    - Big integer encodings such as `biguint64` and `bigint64`.

- **Buffer Encodings:**
    - `buffer` – For Buffer values.
    - `binary` – An alias for buffer encoding.

- **String Encodings with Fixed Length:**
    - Encodings like `string.fixed(10)` allow you to specify a fixed length for a string. This encoder ensures that the encoded value always occupies a specified number of bytes.

- **Composite and Array Encodings:**
    - Encoders for arrays, objects, and more complex structures are also available.

- **Custom Encodings:**
    - You can also build custom encoders by combining available ones, or by defining your own using the compact-encoding API.

---

## Constructing the Encoding String

The encoding configuration for a node is given as a string that specifies both the type and, optionally, parameters. The string is parsed by the `getEncoder` function to retrieve the corresponding encoder from the compact-encoding library. Here’s how it works:

1. **Format:**  
   The encoding string is typically formatted as:

   ```
   <namespace>.<encoderName>(<arguments>)
   ```

   For example:

    - `"string.fixed(10)"`  
      Indicates a fixed-length string encoder with a fixed length of 10 bytes.

    - `"raw.utf8"`  
      Specifies the raw UTF-8 encoder.

    - `"uint8"`  
      Refers to an 8-bit unsigned integer encoder.

2. **Parsing the String:**  
   The `getEncoder` function:

    - **Removes an optional `"cenc."` prefix** if present.
    - **Splits the string** by the dot separator to navigate through the nested structure of the compact-encoding library.
    - **Handles function calls:**  
      If a segment of the string includes parameters (e.g. `"fixed(10)"`), it extracts the function name and arguments. Numeric arguments are converted to numbers, and if necessary, additional encoders can be looked up for non-numeric arguments.

3. **Example Construction:**

    - To encode a string with fixed length:

      ```js
      const encodingStr = "string.fixed(10)";
      const encoder = getEncoder(encodingStr);
      ```

    - To encode a buffer in UTF-8:

      ```js
      const encodingStr = "raw.utf8";
      const encoder = getEncoder(encodingStr);
      ```

    - For an 8-bit unsigned integer:

      ```js
      const encodingStr = "uint8";
      const encoder = getEncoder(encodingStr);
      ```

---

## Using Encodings with ReactiveNode

When creating a node, you can pass the `valueEncoding` configuration option. For example:

```js
import { createNode } from "./node/index.js";

// Create a node with JSON encoding.
const node = createNode({ name: "Alice", age: 30 }, null, {
  valueEncoding: "json"
});

// Setting the value will encode it into a Buffer.
node.value = { name: "Alice", age: 30 };

// When you get the value, it will be automatically decoded:
console.log(node.value); // Outputs: { name: "Alice", age: 30 }
```

The encoding/decoding process works as follows:

- **Setting a Value:**  
  The node’s setter uses the provided `valueEncoding` string to look up the encoder (via `getEncoder`) and then calls `encodeValue` to store an encoded version of the value internally (in a Buffer). The raw value is also stored.

- **Getting a Value:**  
  When retrieving the value, the getter checks:
    - If an encoding is active (i.e. `valueEncoding` is not `"any"`) and if the internally stored encoded value is a Buffer.
    - If so, it decodes the Buffer using `decodeValue`.
    - If the encoded value is not a Buffer, it returns the raw stored value.
    - Any errors during decoding are propagated.

---

## Error Handling and Fallbacks

- **Decoding Failures:**  
  If the stored encoded value is a Buffer but decoding fails (e.g. because the buffer is corrupted or the encoder expects a different format), the getter will throw an error. This ensures that serialization problems are not silently ignored.

- **Non-Buffer Values:**  
  If the encoded value is not a Buffer, the getter simply returns the raw value. In this case, if type checking is enabled, it will validate the raw value accordingly.

---

## Summary

- **Encodings are specified via a string**, such as `"string.fixed(10)"`, `"raw.utf8"`, or `"uint8"`.
- The **`getEncoder` function** parses this string and retrieves the appropriate encoder from the compact-encoding library.
- When a node is created with a non-default encoding, values are **automatically encoded** (to a Buffer) on set and **decoded** on get.
- **Error handling** is built in: decoding is attempted only if the internal encoded value is a Buffer; otherwise, the raw value is returned, and type checking (if present) takes over.

This flexible system allows ReactiveNode to handle serialization seamlessly while preserving backwards compatibility for nodes that do not use encoding.
