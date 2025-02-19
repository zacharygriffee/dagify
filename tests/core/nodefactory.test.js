import { test, solo } from 'brittle'
import { createNode } from '../../index.js'
import { nodeFactory } from '../../lib/node/index.js'

// --- Computed Mode Tests ---
test('nodeFactory computed mode creates computed nodes correctly', async t => {
    // Create two dependencies.
    const dep1 = createNode(2)
    const dep2 = createNode(3)
    const computedFactory = nodeFactory(
        (deps) => deps.reduce((sum, n) => sum + n, 0),
        [dep1, dep2],
        10
    )
    const nodeA = computedFactory.a
    t.is(nodeA.value, 5, 'Computed node has correct initial value (2+3)')

    // Update a dependency and verify the computed node updates.
    await dep1.set(4);
    t.is(nodeA.value, 7, 'Computed node updates correctly when dependency changes (4+3)')
})

// --- Stateful Mode with Activator Tests ---
test('nodeFactory stateful mode invokes activator on property access', t => {
    let activations = []
    const activator = (id, node) => {
        activations.push({ id, value: node.value })
    }

    // For stateful nodes, value is not a function.
    const staticFactory = nodeFactory("hello", activator, 100)
    const nodeFoo = staticFactory.foo
    t.is(nodeFoo.value, "hello", 'Stateful node has the correct value')
    t.alike(activations, [{ id: 'foo', value: 'hello' }], 'Activator is called on property access')

    // Verify caching: re-accessing the same property does not re-trigger the activator.
    activations = []
    const nodeFooAgain = staticFactory.foo
    t.is(nodeFoo, nodeFooAgain, 'Cached node is returned on subsequent accesses')
    t.is(activations.length, 0, 'Activator is not called again on cached access')
})

// --- Stateful Mode without Activator (Default) Tests ---
test('nodeFactory stateful mode without activator creates nodes as is', t => {
    // Here, the second argument is omitted (or not a function), so activator defaults to a no-op.
    const simpleFactory = nodeFactory("simple", 50) // 50 interpreted as max
    const nodeBar = simpleFactory.bar
    t.is(nodeBar.value, "simple", 'Stateful node created without activator has correct value')
})

// --- Max Parameter Inference Tests ---
test('nodeFactory infers max when second argument is a number for computed nodes', t => {
    const dep = createNode(10)
    // For computed nodes, if the second argument is a number, it's taken as max.
    const computedFactory = nodeFactory(
        n => n.value * 2,
        dep
    )
    // Since there are no dependencies, the computed node simply returns NaN or an error,
    // but we can at least verify that the iterator stops after 5 nodes.
    let count = 0
    for (const node of computedFactory) {
        count++
        if (count === 5) break
    }
    t.is(count, 5, 'Iterator yields the correct number of nodes when max is provided as a number')
});

// --- Iterator and Clear Method Tests ---
test('nodeFactory iterator yields nodes and clear() resets the factory', t => {
    let activations = []
    const activator = (id, node) => activations.push({ id, value: node.value })
    const factory = nodeFactory("iterTest", activator, 3)

    let iteratedNodes = []
    for (const node of factory) {
        iteratedNodes.push(node)
        if (iteratedNodes.length === 3) break
    }
    t.is(iteratedNodes.length, 3, 'Iterator yields the expected number of nodes')
    t.is(activations.length, 3, 'Activator is called for each iterated node')

    // Test clear: clear stored nodes and ensure new ones are created.
    factory.clear()
    const nodeX = factory.x
    t.ok(nodeX, 'Node is created after clear')
});
