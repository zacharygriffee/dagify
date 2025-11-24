import {ensureShared} from "../rxjs/ensureShared.js"; // your dagify node creator

let ReactiveNodeCtor;
const setFromObservableNodeCtor = (ctor) => {
    ReactiveNodeCtor = ctor;
};
const getCtor = () => {
    if (!ReactiveNodeCtor) {
        throw new Error("ReactiveNode constructor not registered for fromObservable.");
    }
    return ReactiveNodeCtor;
};
/**
 * Wraps an observable-like object in a dagify node.
 * The node is updated for every observable emission.
 * When the observable errors or completes, the node is signaled accordingly.
 *
 * @param {Object} obs - The observable to wrap (must have a subscribe method).
 * @param {any} initialValue - The initial value for the node.
 * @param {Object} [config={}] - Optional node configuration passed to ReactiveNode.
 * @returns {Object} - The dagify node that mirrors the observable.
 */
function fromObservable(obs, initialValue, config = {}) {
    obs = ensureShared(obs);
    const NodeCtor = getCtor();
    const node = new NodeCtor(initialValue, null, config);
    let finished = false;
    let subscription;

    // Cleanup function: ensures that unsubscription and error/completion propagation
    // occur only once and tolerates sync-completing sources.
    function unsub(err) {
        if (finished) return;
        finished = true;
        if (subscription && typeof subscription.unsubscribe === "function") {
            subscription.unsubscribe();
        }
        (err ? node.error : node.complete)?.call(node, err);
    }

    // Subscribe to the node's complete event so that if the node itself completes,
    // we trigger the cleanup (unsub).
    node.subscribe({ complete: unsub });

    // Subscribe to the observable.
    subscription = obs.subscribe({
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

    return node;
}

export { fromObservable, setFromObservableNodeCtor };
