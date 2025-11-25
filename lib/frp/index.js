import { createNode, NO_EMIT } from "../node/index.js";
import { isPlainObject } from "../util/IsPlainObject.js";
import { fromObservable } from "../util/fromObservable.js";
import { isRxObservable } from "../rxjs/isRxObservable.js";
import { ensureShared } from "../rxjs/ensureShared.js";
import { invokeOnNode } from "../effect/invokeOnNode.js";
import {
    combineLatest,
    defer,
    filter as rxFilter,
    from as rxFrom,
    isObservable as isRxJsObservable,
    map as rxMap,
    merge as mergeObs,
    of,
    switchMap,
    take
} from "rxjs";

const normalizeOptions = (options = {}) => ({
    initialValue: options.initialValue ?? NO_EMIT,
    nodeConfig: options.config ?? options.nodeConfig ?? {},
    triggerOnNoEmit: options.triggerOnNoEmit ?? false
});

const isThenable = (input) => input && typeof input.then === "function";
const isDagifyNode = (input) => input?.isDagifyNode === true;

const toObservable = (source) => {
    if (source?.isDagifyNode) return source.stream;
    if (isRxObservable(source)) return ensureShared(source);
    throw new TypeError("Expected a Dagify node or RxJS observable.");
};

const sanitizeSource = (source, triggerOnNoEmit) => {
    const obs = toObservable(source);
    if (triggerOnNoEmit) return obs;
    return obs.pipe(rxFilter(value => value !== NO_EMIT));
};

const map = (source, projector, options) => {
    const { initialValue, nodeConfig, triggerOnNoEmit } = normalizeOptions(options);
    const obs = sanitizeSource(source, triggerOnNoEmit).pipe(rxMap(projector));
    return fromObservable(obs, initialValue, nodeConfig);
};

const filter = (source, predicate, options) => {
    const { initialValue, nodeConfig, triggerOnNoEmit } = normalizeOptions(options);
    const obs = sanitizeSource(source, triggerOnNoEmit).pipe(rxFilter(predicate));
    return fromObservable(obs, initialValue, nodeConfig);
};

const combine = (sources, projector, options) => {
    const { initialValue, nodeConfig, triggerOnNoEmit } = normalizeOptions(options);
    if (Array.isArray(sources)) {
        if (sources.length === 0) {
            throw new TypeError("combine requires at least one source.");
        }
        const obs = combineLatest(sources.map(src => sanitizeSource(src, triggerOnNoEmit)));
        const projected = projector
            ? obs.pipe(rxMap(values => projector(...values)))
            : obs;
        return fromObservable(projected, initialValue, nodeConfig);
    }
    if (isPlainObject(sources)) {
        const keys = Object.keys(sources);
        if (keys.length === 0) {
            throw new TypeError("combine requires at least one source.");
        }
        const obs = combineLatest(keys.map(key => sanitizeSource(sources[key], triggerOnNoEmit))).pipe(
            rxMap(values => {
                const combined = {};
                values.forEach((value, idx) => {
                    combined[keys[idx]] = value;
                });
                return projector ? projector(combined) : combined;
            })
        );
        return fromObservable(obs, initialValue, nodeConfig);
    }
    throw new TypeError("combine sources must be an array or plain object.");
};

const merge = (sources, options) => {
    const { initialValue, nodeConfig, triggerOnNoEmit } = normalizeOptions(options);
    const list = Array.isArray(sources) ? sources : [sources];
    if (list.length === 0) {
        throw new TypeError("merge requires at least one source.");
    }
    const obs = mergeObs(...list.map(source => sanitizeSource(source, triggerOnNoEmit)));
    return fromObservable(obs, initialValue, nodeConfig);
};

const switchLatest = (source, projector = value => value, options) => {
    const { initialValue, nodeConfig, triggerOnNoEmit } = normalizeOptions(options);
    const obs = sanitizeSource(source, triggerOnNoEmit).pipe(
        switchMap(value => toObservable(projector(value)))
    );
    return fromObservable(obs, initialValue, nodeConfig);
};

/**
 * Recursively resolves async-ish inputs to a single emission.
 * - Observables (or Dagify nodes) emit their first value then recurse.
 * - Promises/thenables resolve then recurse.
 * - Zero-arg functions are invoked and their result is recursed.
 * - Otherwise, the plain value is emitted.
 */
const floorAsync = (input) => defer(() => {
    const value = typeof input === "function" && input.length === 0 ? input() : input;

    if (isDagifyNode(value)) {
        return value.stream.pipe(
            rxFilter(v => v !== NO_EMIT),
            take(1),
            switchMap(v => floorAsync(v))
        );
    }

    const observable = (isRxObservable(value) ? ensureShared(value) : null)
        || (isRxJsObservable(value) ? value : null);
    if (observable) {
        return observable.pipe(
            take(1),
            switchMap(v => floorAsync(v))
        );
    }

    if (isThenable(value)) {
        return rxFrom(value).pipe(
            take(1),
            switchMap(v => floorAsync(v))
        );
    }

    return of(value);
});

const from = (input, options) => {
    const { initialValue, nodeConfig } = normalizeOptions(options);
    if (input?.isDagifyNode) return input;
    if (isRxObservable(input)) {
        return fromObservable(input, initialValue, nodeConfig);
    }
    if (input && typeof input.then === "function") {
        const store = createNode(initialValue, undefined, nodeConfig);
        Promise.resolve(input)
            .then(value => store.set(value))
            .catch(err => store.error(err));
        return store;
    }
    return createNode(input, undefined, nodeConfig);
};

const createStore = (initialValue, config) => createNode(initialValue, undefined, config);

export { map, filter, combine, merge, switchLatest, from, createStore, invokeOnNode, floorAsync };
