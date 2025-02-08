export const deepEqual = (a, b) => {
    if (a === b) {
        // Handle primitive types and references
        return true;
    }

    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
        // If either is not an object (or is null), they are not equal
        return false;
    }

    if (Array.isArray(a) !== Array.isArray(b)) {
        // If one is an array and the other is not, they are not equal
        return false;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
        // If the objects have different numbers of keys, they are not equal
        return false;
    }

    // Check that all keys and their values are equal recursively
    for (const key of keysA) {
        if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
            return false;
        }
    }

    return true;
};

export const notDeepEqual = (a, b) => !deepEqual(a, b);