# Diff Operator Documentation

The **diffOperator** is an RxJS operator that transforms a stream of arrays into a stream of diff objects. It compares consecutive array emissions on an element-by-element basis and produces an object representing the changes.

---

## Overview

The operator analyzes two consecutive arrays (the previous and the current emission) and determines, for each corresponding index, whether an element was:

- **Added**: Present in the new array but not in the old array (or where the old value is `undefined`).
- **Removed**: Present in the old array but not in the new array (or where the new value is `undefined`).
- **Changed**: Present in both arrays at the same index but differing based on a provided equality checker.
- **Unchanged**: Present in both arrays and considered equal.

The diff is returned as an object that may include the following properties:

- **`new`**: An array of elements that were added.
- **`del`**: An array of elements that were removed.
- **`same`**: An array of elements that remain unchanged.

By default, the operator starts by comparing the first emission against an empty array, so the entire first array is considered as "new."

---

## API

### Function Signature

```javascript
diffOperator(options?: {
  initial?: boolean,
  eq?: (a: T, b: T) => boolean
}): OperatorFunction<T[], { new?: T[], del?: T[], same?: T[] }>
```

### Parameters

- **`options`** (optional): An object with the following properties:
  - **`initial`** (`boolean`, default: `true`):  
    When set to `true`, the first emission is compared against an empty array, marking all its elements as "new."
  - **`eq`** (`function`, optional):  
    A custom equality checker function that takes two arguments and returns a boolean indicating whether they should be considered equal. If not provided, strict equality (`===`) is used.

### Returns

An RxJS operator function that takes an observable stream of arrays (`T[]`) and returns an observable stream of diff objects with the following properties (if applicable):

- **`new`**: Array of added elements.
- **`del`**: Array of removed elements.
- **`same`**: Array of unchanged elements.

---

## Behavior and Comparison Rules

For each pair of arrays:

1. **Added Elements:**
  - If an element exists in the new array at an index where the previous array has no element (or `undefined`), it is considered **added**.

2. **Removed Elements:**
  - If an element exists in the previous array at an index where the new array has no element (or `undefined`), it is considered **removed**.

3. **Changed Elements:**
  - If both arrays have values at the same index but the provided equality checker (or strict equality by default) returns `false`, then the new element is treated as **added** and the old element as **removed**.

4. **Unchanged Elements:**
  - If the elements at the same index are considered equal (per the equality checker), they are marked as **unchanged**.

---

## Usage Examples

### Default Behavior (Strict Equality)

When using the diffOperator with default options, given an initial array and a subsequent update:

- **Initial emission** (compared against an empty array) produces a diff object marking the entire array as "new."
- **Subsequent emissions** compare the previous and current arrays element by element. For example, if an array changes from `[0, 1, 2, 0]` to `[0, 1, 2, 2]`, the operator might output:

```json
{
  "new": [2],      // The element at the changed index is considered added.
  "del": [0],      // The previous element at that index is considered removed.
  "same": [0, 1, 2]  // The unchanged elements remain marked as same.
}
```

### Using a Custom Equality Checker

For arrays of objects, you may wish to compare elements based on a specific property rather than strict equality. For example, using a custom equality checker:

```javascript
diffOperator({ eq: (a, b) => a.id === b.id })
```

In this case, if the array changes from:

```javascript
[
  { id: 1, value: 'a' },
  { id: 2, value: 'b' }
]
```

to

```javascript
[
  { id: 1, value: 'a' },
  { id: 2, value: 'c' }
]
```

the diffOperator will consider the objects with `id: 2` as equal (even though the `value` has changed), and mark the updated array as unchanged:

```json
{
  "new": [{ id: 1, value: 'a' }, { id: 2, value: 'b' }],
  "same": [{ id: 1, value: 'a' }, { id: 2, value: 'c' }]
}
```

This allows you to focus on identity comparisons rather than deep object equality.

---

## Summary

The **diffOperator** is a versatile RxJS operator designed to track and report the differences between consecutive array emissions. By providing options to customize initial behavior and equality checking, it can be tailored to various data structures and comparison needs in reactive programming. This operator is particularly useful when you need to detect and respond to incremental changes in arrays over time.
