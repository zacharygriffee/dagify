import { createNode, NO_EMIT } from "../node/index.js";
import { isPlainObject } from "../util/IsPlainObject.js";
import { fromObservable } from "../util/fromObservable.js";
import { isRxObservable } from "../rxjs/isRxObservable.js";
import { ensureShared } from "../rxjs/ensureShared.js";
import { merge as mergeObs, combineLatest } from "rxjs";
import { map as rxMap, filter as rxFilter, switchMap } from "rxjs/operators";

const normalizeOptions = (options = {}) => ({
    initialValue: options.initialValue ?? NO_EMIT,
    nodeConfig: options.config ?? options.nodeConfig ?? {}
});

const toObservable = (source) => {
    if (source?.isDagifyNode) return source.stream;
    if (isRxObservable(source)) return ensureShared(source);
    throw new TypeError("Expected a Dagify node or RxJS observable.");
};

const map = (source, projector, options) => {
    const { initialValue, nodeConfig } = normalizeOptions(options);
    const obs = toObservable(source).pipe(rxMap(projector));
    return fromObservable(obs, initialValue, nodeConfig);
};

const filter = (source, predicate, options) => {
    const { initialValue, nodeConfig } = normalizeOptions(options);
    const obs = toObservable(source).pipe(rxFilter(predicate));
    return fromObservable(obs, initialValue, nodeConfig);
};

const combine = (sources, projector, options) => {
    const { initialValue, nodeConfig } = normalizeOptions(options);
    if (Array.isArray(sources)) {
        if (sources.length === 0) {
            throw new TypeError("combine requires at least one source.");
        }
        const obs = combineLatest(sources.map(toObservable));
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
        const obs = combineLatest(keys.map(key => toObservable(sources[key]))).pipe(
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
    const { initialValue, nodeConfig } = normalizeOptions(options);
    const list = Array.isArray(sources) ? sources : [sources];
    if (list.length === 0) {
        throw new TypeError("merge requires at least one source.");
    }
    const obs = mergeObs(...list.map(toObservable));
    return fromObservable(obs, initialValue, nodeConfig);
};

const switchLatest = (source, projector = value => value, options) => {
    const { initialValue, nodeConfig } = normalizeOptions(options);
    const obs = toObservable(source).pipe(
        switchMap(value => toObservable(projector(value)))
    );
    return fromObservable(obs, initialValue, nodeConfig);
};

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

export { map, filter, combine, merge, switchLatest, from, createStore };
