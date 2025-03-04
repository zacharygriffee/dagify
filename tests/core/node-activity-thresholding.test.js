import {solo, test} from "brittle";
import { createNode } from "../../lib/node/index.js";
import { sleep } from "../helpers/sleep.js";

/* --------------------------------------------------------------------------
   Activity-Thresholding Tests (with explicit cleanup)
-------------------------------------------------------------------------- */

test("activity thresholding: compute triggers only after threshold visits", async t => {
    let computeCount = 0;
    const node = createNode(
        () => {
            computeCount++;
            return computeCount;
        },
        undefined,
        { enableActivityThresholding: true, activationThreshold: 3, decayInterval: 100 }
    );

    // On creation, compute() runs so value is 1.
    t.is(node.value, 1, "Initial compute is performed on creation");

    // Call visit() twice (below threshold).
    node.visit();
    node.visit();
    // Wait long enough (250ms) so that decay fully resets the activity counter to 0.
    await sleep(250);

    // Now call two visits; since activity level starts at 0,
    // two visits should bring it to 2, which is still below threshold.
    node.visit();
    node.visit();
    await sleep(50);
    // Value remains unchanged because compute() wasn't triggered.
    t.is(node.value, 1, "No update if visits decay completely before new consecutive visits");

    // Now call three visits in quick succession.
    node.visit();
    node.visit();
    node.visit();
    await sleep(50);
    // This should trigger compute() once, so value updates from 1 to 2.
    t.is(node.value, 2, "Update triggered after three consecutive visits");

    // Explicitly clean up the node (clears timers and subscriptions)
    node.complete();
});

test("activity thresholding: activity level resets after compute fires", async t => {
    let computeCount = 0;
    const node = createNode(
        () => {
            computeCount++;
            return computeCount;
        },
        undefined,
        { enableActivityThresholding: true, activationThreshold: 3, decayInterval: 100 }
    );

    t.is(node.value, 1, "Initial compute is performed on creation");

    // Trigger a compute with 3 visits.
    node.visit();
    node.visit();
    node.visit();
    await sleep(50);
    t.is(node.value, 2, "Compute fired after threshold reached");

    // One additional visit should not trigger compute because
    // the activity counter was reset after compute fired.
    node.visit();
    await sleep(50);
    t.is(node.value, 2, "Activity level reset prevents premature compute");

    node.complete();
});

test("activity thresholding: immediate compute when disabled", async t => {
    let computeCount = 0;
    const node = createNode(
        () => {
            computeCount++;
            return computeCount;
        },
        undefined,
        { enableActivityThresholding: false } // activity thresholding is disabled
    );

    t.is(node.value, 1, "Initial compute is performed on creation");

    // Calling visit() when thresholding is disabled should trigger immediate compute.
    node.visit();
    await sleep(50);
    t.is(node.value, 2, "Immediate compute when activity thresholding is disabled");

    node.complete();
});
