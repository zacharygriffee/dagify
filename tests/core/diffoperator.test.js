import {test, solo} from "brittle";
import {skip, Subject, take} from "rxjs";
import {diffOperator} from "../../lib/operators/index.js";
import {createNode} from "../../lib/node/index.js";
import {sleep} from "../helpers/sleep.js";
import {createComposite} from "../../lib/composite/index.js";

test("new entries", async t => {
    t.plan(1);
    const sub = new Subject();

    sub.pipe(diffOperator(), take(1)).subscribe(sub => {
        t.alike([1, 2, 3, 4, 5], sub.new);
    });

    sub.next([1, 2, 3, 4, 5]);
});

test("del entries", async t => {
    t.plan(1);
    const sub = new Subject();
    sub.pipe(diffOperator(), skip(1)).subscribe(sub => {
        t.alike([4, 5], sub.del);
    });
    sub.next([1, 2, 3, 4, 5]);
    sub.next([1, 2, 3]);
});

test("same entries", async t => {
    t.plan(1);
    const sub = new Subject();
    sub.pipe(diffOperator(), skip(1)).subscribe(sub => {
        t.alike([1, 2, 3], sub.same);
    });
    sub.next([1, 2, 3, 4, 5]);
    sub.next([1, 2, 3]);
});

test("diff property on createNode", async t => {
    const x = createNode([1, 2, 3]);
    const newOnes = createNode(t => t.new, x.pipe(diffOperator()));
    t.alike(newOnes.value, [1, 2, 3]);
    x.set([1, 2, 3, 4]);
    await sleep();
    t.alike(newOnes.value, [4]);
    x.complete();
    newOnes.complete();
});

test("diff property on computed", async t => {
    // Array to collect diff emissions from the computed node.
    const values = [];

    // Create nodes.
    // 'x' is a simple node with an initial value of 0.
    const x = createNode(0);
    // 'y' is a node holding an array [0, 1, 2].
    const y = createNode([0, 1, 2]);
    // 'z' is a computed node that depends on 'x' and 'y'.
    // It returns a new array consisting of all elements from 'y' and an additional element:
    // the element from 'y' at the index specified by 'x'.
    // Initially: [...[0, 1, 2], [0, 1, 2][0]] yields [0, 1, 2, 0].
    const z = createNode(([x, y]) => [...y, y[x]], [x, y]);

    // Subscribe to 'z' with the diffOperator, which calculates the element-wise diff.
    // The computed diff objects are pushed into the 'values' array.
    const zSub = z.diff.subscribe(sub => {
        values.push(sub);
    });

    // Update 'x' to trigger a recomputation of 'z'.
    // Now, 'z' computes to [...[0, 1, 2], [0, 1, 2][2]] which is [0, 1, 2, 2].
    x.set(2);

    // Wait for asynchronous updates to propagate.
    await sleep();

    // Expected diff values:
    // 1. First emission (comparing against an empty array) produces:
    //    { "new": [0, 1, 2, 0] }
    // 2. Second emission (comparing [0, 1, 2, 0] with [0, 1, 2, 2]) produces:
    //    { "new": [2], "del": [0], "same": [0, 1, 2] }
    t.alike(values, [{
        "new": [0, 1, 2, 0]
    }, {
        "new": [2], "del": [0], "same": [0, 1, 2]
    }]);

    // Cleanup: unsubscribe from the computed node's subscription and complete the nodes.
    zSub.unsubscribe();
    x.complete();
    y.complete();
    z.complete();
});


test("diff property with eq function", async t => {
    // Array to collect diff emissions.
    const values = [];

    // Create a node with an initial array of objects.
    // Each object has an 'id' and a 'value' property.
    const node = createNode([
        { id: 1, value: 'a' },
        { id: 2, value: 'b' }
    ]);

    // Create a computed node that simply passes through the array from 'node'.
    // This ensures that any changes in 'node' are reflected in the computed node.
    const comp = createNode(([arr]) => arr, [node]);

    // Subscribe to the computed node using diffOperator with a custom equality function.
    // The custom eq function compares objects based solely on their 'id' property.
    // With this, even if the 'value' property changes, the objects are considered equal.
    // Since the default 'initial' option is true, the first emission compares against an empty array.
    const sub = comp
        .pipe(diffOperator({ eq: (a, b) => a.id === b.id }))
        .subscribe(diff => {
            values.push(diff);
        });

    // Wait for the initial emission to propagate.
    await sleep();

    // Update the node by changing the 'value' property of the second object.
    // Although the object changes from { id: 2, value: 'b' } to { id: 2, value: 'c' },
    // the custom eq function will consider the objects equal (since their ids are the same).
    node.set([
        { id: 1, value: 'a' },
        { id: 2, value: 'c' }
    ]);

    // Wait for the update to propagate.
    await sleep();

    // Expected diff values:
    // 1. First emission (compared to an empty array) produces:
    //      { new: [ { id: 1, value: 'a' }, { id: 2, value: 'b' } ] }
    //
    // 2. Second emission (comparing previous array with updated array):
    //    Although the second object's 'value' has changed, the custom eq function
    //    considers both objects equal (by id). Thus, the entire updated array is marked as unchanged:
    //      { same: [ { id: 1, value: 'a' }, { id: 2, value: 'c' } ] }
    t.alike(values, [
        { new: [{ id: 1, value: 'a' }, { id: 2, value: 'b' }] },
        { same: [{ id: 1, value: 'a' }, { id: 2, value: 'c' }] }
    ]);

    // Cleanup: Unsubscribe and complete nodes.
    sub.unsubscribe();
    node.complete();
    comp.complete();
});

test("diff on composite node", async t => {
    const values = [];
    const x = createNode(5);
    const y = createNode(6);

    const composite = createComposite([x,y]);
    const compositeSub = composite.diff.subscribe(val => values.push(val));
    await sleep();
    await x.set(4);

    t.alike(values, [{
        "new": [5, 6]
    }, {
        "new": [4], "del": [5], "same": [6]
    }]);

    compositeSub.unsubscribe();
    composite.complete();
    x.complete();
    y.complete();
})
