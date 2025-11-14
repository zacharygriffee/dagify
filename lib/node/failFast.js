const DEFAULT_FATAL_ERROR_NAMES = new Set([
    "ReferenceError",
    "SyntaxError",
    "TypeError",
    "RangeError",
    "EvalError",
    "URIError",
    "AssertionError"
]);

let globalFailFastEnabled = true;
let customFailFastPredicate = null;

const defaultFatalErrorPredicate = (error) => {
    if (!error) return false;
    const name = error.name;
    if (DEFAULT_FATAL_ERROR_NAMES.has(name)) return true;
    if (error.code === "ERR_ASSERTION") return true;
    return false;
};

const resolvePredicate = (predicateOverride) => {
    if (typeof predicateOverride === "function") return predicateOverride;
    if (typeof customFailFastPredicate === "function") return customFailFastPredicate;
    return defaultFatalErrorPredicate;
};

const shouldFailFast = (error, predicateOverride, enabledOverride) => {
    const enabled = enabledOverride !== undefined ? enabledOverride : globalFailFastEnabled;
    if (!enabled) return false;
    const predicate = resolvePredicate(predicateOverride);
    try {
        return predicate ? predicate(error) === true : false;
    } catch {
        return false;
    }
};

const setFailFastPredicate = (predicate) => {
    customFailFastPredicate = typeof predicate === "function" ? predicate : null;
};

const setFailFastEnabled = (enabled) => {
    globalFailFastEnabled = !!enabled;
};

export {
    defaultFatalErrorPredicate,
    setFailFastEnabled,
    setFailFastPredicate,
    shouldFailFast
};
