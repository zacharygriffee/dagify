import { createNode, NO_EMIT } from "../node/index.js";

/**
 * Creates a filter node that only emits values which pass the provided predicate.
 *
 * This function wraps the given predicate inside a reactive node using `createNode`. When the node
 * receives a value (referred to as "subject"), it applies the predicate. If the predicate returns
 * a truthy value, the node emits the original subject. Otherwise, it emits the `NO_EMIT` marker,
 * indicating that the value should be filtered out.
 *
 * @param {function(*): boolean} predicate - A function that tests each incoming value. It should return `true`
 *     if the value should be emitted, or `false` otherwise.
 * @param {(ReactiveNode | CompositeNode | Function | Promise | Observable) |        (ReactiveNode | CompositeNode | Function | Promise | Observable)[] |        { [key: string]: ReactiveNode | CompositeNode | Function | Promise | Observable }} [dependencies=[]]
 * - The dependencies for computed nodes.
 *     of the filter predicate.
 * @returns {*} A reactive node that only emits values passing the predicate.
 */
const createFilterNode = (predicate, deps) =>
    createNode(subject => predicate(subject) ? subject : NO_EMIT, deps);

export { createFilterNode };
