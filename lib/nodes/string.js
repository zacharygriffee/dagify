import {validateArrayStrings, validateNumber, validateString} from "./validations.js";
import {createNode} from "../../index.secure.js"; // or however you import/create nodes

// Node for a string literal
const string = (x) => createNode(validateString(x));

// Concatenates an array of strings
const concat = (strings) =>
    createNode(
        (strings) => {
            // Validate that all elements are strings
            const validStrings = validateArrayStrings(strings);
            return validStrings.join('');
        },
        strings
    );

// Converts a string to uppercase
const toUpperCase = (x) =>
    createNode(
        (x) => validateString(x).toUpperCase(),
        x
    );

// Converts a string to lowercase
const toLowerCase = (x) =>
    createNode(
        (x) => validateString(x).toLowerCase(),
        x
    );

// Trims whitespace from the start and end of a string
const trim = (x) =>
    createNode(
        (x) => validateString(x).trim(),
        x
    );

// Extracts a substring from a string given a start index and optional end index.
// If end index is not provided, it returns the substring to the end of the string.
const substring = ([x, start, end]) =>
    createNode(
        ([x, start, end]) => {
            const str = validateString(x);
            validateNumber(start);
            validateNumber(end);
            // Validate that start (and end, if provided) are numbers
            if (typeof start !== 'number' || (end !== undefined && typeof end !== 'number')) {
                throw new TypeError('Expected start and end indices to be numbers');
            }
            return end !== undefined ? str.substring(start, end) : str.substring(start);
        },
        [x, start, end]
    );

// Checks if a string includes a given substring
const includes = ([x, searchString]) =>
    createNode(
        ([x, searchString]) => {
            const str = validateString(x);
            const search = validateString(searchString);
            return str.includes(search);
        },
        [x, searchString]
    );

// Splits a string by the provided separator into an array of strings
const split = ([x, separator]) =>
    createNode(
        ([x, separator]) => {
            const str = validateString(x);
            // Allow separator to be a string or a regular expression
            if (!(typeof separator === 'string' || separator instanceof RegExp)) {
                throw new TypeError('Expected separator to be a string or RegExp');
            }
            return str.split(separator);
        },
        [x, separator]
    );

export {
    string,
    concat,
    toUpperCase,
    toLowerCase,
    trim,
    substring,
    includes,
    split
};
