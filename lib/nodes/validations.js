import b4a from "b4a";

// Assume validateOrError is defined like this:
const validateOrError = (x, predicate, error) => {
    if (!predicate(x)) throw error;
    return x;
};

// Validate a number (ensuring it's of type 'number' and not NaN)
const validateNumber = x =>
    validateOrError(
        x,
        x => typeof x === 'number' && !isNaN(x),
        new TypeError('Expected a number')
    );

// Validate a string
const validateString = x =>
    validateOrError(
        x,
        x => typeof x === 'string',
        new TypeError('Expected a string')
    );

// Validate a boolean
const validateBoolean = x =>
    validateOrError(
        x,
        x => typeof x === 'boolean',
        new TypeError('Expected a boolean')
    );

// Validate a function
const validateFunction = x =>
    validateOrError(
        x,
        x => typeof x === 'function',
        new TypeError('Expected a function')
    );

// Validate an array (of any type)
const validateArray = x =>
    validateOrError(x, Array.isArray, new TypeError('Expected an array'));

// Validate an object (non-null and not an array)
const validateObject = x =>
    validateOrError(
        x,
        x => x !== null && typeof x === 'object' && !Array.isArray(x),
        new TypeError('Expected an object')
    );

// Validate a Buffer using b4a library's isBuffer method
const validateBuffer = x =>
    validateOrError(x, b4a.isBuffer, new TypeError('Expected a buffer'));

// Array validations for each type:

// Array of numbers
const validateArrayNumbers = x =>
    validateOrError(
        x,
        x => Array.isArray(x) && x.every(y => typeof y === 'number' && !isNaN(y)),
        new TypeError('Expected an array of numbers')
    );

// Array of strings
const validateArrayStrings = x =>
    validateOrError(
        x,
        x => Array.isArray(x) && x.every(y => typeof y === 'string'),
        new TypeError('Expected an array of strings')
    );

// Array of booleans
const validateArrayBooleans = x =>
    validateOrError(
        x,
        x => Array.isArray(x) && x.every(y => typeof y === 'boolean'),
        new TypeError('Expected an array of booleans')
    );

// Array of buffers
const validateArrayBuffers = x =>
    validateOrError(
        x,
        x => Array.isArray(x) && x.every(b4a.isBuffer),
        new TypeError('Expected an array of buffers')
    );


export {
    validateOrError,
    validateNumber,
    validateString,
    validateBoolean,
    validateFunction,
    validateArray,
    validateObject,
    validateBuffer,
    validateArrayNumbers,
    validateArrayStrings,
    validateArrayBooleans,
    validateArrayBuffers
};