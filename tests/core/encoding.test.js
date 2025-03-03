import test from 'brittle';
import {ReactiveNode} from "../../lib/node/ReactiveNode.js";
import {createNode} from "../../lib/node/index.js";

// Test that a static node with encoding properly encodes and decodes a value.
test('encoding: static node encodes and decodes correctly', t => {
    // Create a node with a value encoding (for example, "json").
    const node = new ReactiveNode({ a: 1 }, null, { valueEncoding: "json" })
    // After setting, _encodedValue should be a Buffer.
    t.ok(Buffer.isBuffer(node._encodedValue), 'Encoded value is a Buffer')
    // The getter should return the original value.
    t.alike(node.value, { a: 1 }, 'Decoded value matches the original')
})

// Test that if _encodedValue is not a Buffer, the getter returns the raw value.
test('encoding: non-buffer _encodedValue returns raw value', t => {
    const node = new ReactiveNode("test", null, { valueEncoding: "json" })
    // Set the value normally.
    node.value = "test"
    // Now override _encodedValue with a non-buffer value.
    node._encodedValue = "not a buffer"
    // The getter should ignore _encodedValue and return the raw _value.
    t.is(node.value, "test", 'Raw value is returned when _encodedValue is not a Buffer')
})

// Test that a static node with a non-default encoding encodes its value to a Buffer
// and returns the correct decoded value.
test("node encoding: static node encodes and decodes correctly", t => {
    // For this test, we assume that the "json" encoding will stringify and then parse the value.
    const original = { a: 1, b: "test" }
    const node = createNode(original, null, { valueEncoding: "json" })

    // After setting the value, the getter should return the original object.
    t.alike(node.value, original, "Decoded value matches the original")
    // And the internally stored _encodedValue should be a Buffer.
    t.ok(Buffer.isBuffer(node._encodedValue), "Internal encoded value is a Buffer")
})

// Test that if _encodedValue is not a Buffer, the getter returns the raw value.
test("node encoding: non-buffer _encodedValue returns raw value", t => {
    const node = createNode("hello", null, { valueEncoding: "json" })
    // Set the value normally.
    node.value = "hello"
    // Now manually override _encodedValue with a non-buffer.
    node._encodedValue = "not a buffer"
    // The getter should return the raw _value.
    t.is(node.value, "hello", "Returns raw value when _encodedValue is not a Buffer")
})
