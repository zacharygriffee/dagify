import test, {solo} from 'brittle';
import { ReactiveNode } from '../../lib/node/ReactiveNode.js'
import { NO_EMIT } from '../../lib/node/NO_EMIT.js'
import {sleep} from "../helpers/sleep.js";

// Helper: Create a node that emits its error via subscription.
function createTestNode(initialValue, type) {
    return new ReactiveNode(initialValue, null, { type })
}

test('ReactiveNode with type "int" accepts valid integer', t => {
    const node = createTestNode(0, 'int')
    // Subscribe to ensure we capture any errors.
    let errorCaught = null
    node.subscribe({ error: err => errorCaught = err })

    // Set a valid integer.
    node.set(42)
    t.is(node.value, 42, 'node value is updated to valid integer')
    t.absent(errorCaught, 'no error was triggered for valid integer')
})

test('ReactiveNode with type "int" rejects non-integer', async t => {
    const node = createTestNode(0, 'int')
    let errorCaught = null
    node.subscribe({ error: err => errorCaught = err })

    // Attempt to set a float.
    node.set(3.14)
    await sleep(0)

    // Value should not update.
    t.is(node.value, 0, 'node value remains unchanged when invalid value is set')
    t.ok(errorCaught, 'error was triggered for non-integer')
    t.ok(errorCaught.message.match(/Type mismatch/), 'error message indicates type mismatch')
})

test('ReactiveNode with type "int64" accepts safe integer and valid bigint', t => {
    const node = createTestNode(0, 'int64')
    let errorCaught = null
    node.subscribe({ error: err => errorCaught = err })

    // Set a safe integer.
    node.set(9007199254740991)
    t.is(node.value, 9007199254740991, 'node accepts MAX_SAFE_INTEGER')

    // Set a valid bigint.
    node.set(BigInt('9223372036854775807'))
    // Because value could be a bigint, we compare string values.
    t.is(node.value.toString(), '9223372036854775807', 'node accepts valid bigint')
    t.absent(errorCaught, 'no error was triggered for valid int64 values')
})

test('ReactiveNode with type "int64" rejects unsafe integer beyond MAX_SAFE_INTEGER', async t => {
    const node = createTestNode(0, 'int64')
    let errorCaught = null
    node.subscribe({ error: err => errorCaught = err })

    // Try to set an unsafe integer.
    node.set(9007199254740992)
    await sleep(0)

    // Expect no update and an error.
    t.is(node.value, 0, 'node value remains unchanged when invalid int64 is set')
    t.ok(errorCaught, 'error was triggered for unsafe integer')
    t.ok(errorCaught.message.match(/Type mismatch/), 'error message indicates type mismatch')
})

test('ReactiveNode with type "string" accepts valid strings and rejects non-string', async t => {
    const node = createTestNode('', 'string')
    let errorCaught = null
    node.subscribe({ error: err => errorCaught = err })

    // Valid string.
    node.set('hello')
    t.is(node.value, 'hello', 'node accepts valid string')
    t.absent(errorCaught, 'no error for valid string')

    // Reset error and try to set a non-string.
    errorCaught = null
    node.set(123)

    await sleep(0)
    t.is(node.value, 'hello', 'node value remains unchanged when non-string is set')
    t.ok(errorCaught, 'error was triggered for non-string')
})

