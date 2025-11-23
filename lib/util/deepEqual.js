const deepEqualInternal = (a, b, seen = new WeakMap()) => {
    if (a === b) {
        return true;
    }

    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
        return false;
    }

    if (Array.isArray(a) !== Array.isArray(b)) {
        return false;
    }

    let cached = seen.get(a);
    if (cached && cached.has(b)) {
        return true;
    }
    if (!cached) {
        cached = new WeakMap();
        seen.set(a, cached);
    }
    cached.set(b, true);

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
        return false;
    }

    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) {
            return false;
        }
        if (!deepEqualInternal(a[key], b[key], seen)) {
            return false;
        }
    }

    return true;
};

export const deepEqual = (a, b) => deepEqualInternal(a, b);

export const notDeepEqual = (a, b) => !deepEqual(a, b);
