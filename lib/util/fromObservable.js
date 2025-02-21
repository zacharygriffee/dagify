import { createNode } from "../../index.secure.js"; // your dagify node creator

/**
 * Wraps an observable-like object in a dagify node.
 * The node is updated for every observable emission.
 * When the observable errors or completes, the node is signaled accordingly.
 *
 * @param {Object} obs - The observable to wrap (must have a subscribe method).
 * @param {any} initialValue - The initial value for the node.
 * @returns {Object} - The dagify node that mirrors the observable.
 */
function fromObservable(obs, initialValue) {
    // Create the dagify node with the initial value.
    const node = createNode(initialValue);
    let finished = false;

    // Subscribe to the node's complete event so that if the node itself completes,
    // we trigger the cleanup (unsub).
    node.subscribe({ complete: unsub });

    // Subscribe to the observable.
    const subscription = obs.subscribe({
        next: value => {
            // Use node.next if available; this allows the node to handle incoming values
            // according to its defined API (which might be a standard Subject-like behavior).
            node.next?.(value);
        },
        error: err => unsub(err),
        complete: () => unsub()
    });

    // Attach the subscription to the node for potential later cleanup.
    node.subscription = subscription;

    // Cleanup function: ensures that unsubscription and error/completion propagation
    // occur only once.
    function unsub(err) {
        if (!finished) {
            subscription.unsubscribe();
            // If there is an error, call node.error; otherwise, call node.complete.
            (err ? node.error : node.complete)?.call(node, err);
            finished = true;
        }
    }

    return node;
}

export { fromObservable };
