import {createNode} from "../../index.js";
import {validateNumber, validateArray, validateArrayNumbers} from "./validations.js";

// Creates a node for a number literal.
const number = (x) => createNode(validateNumber(x));

// Basic arithmetic operations.
const add = ([a, b]) =>
    createNode(
        ([a, b]) => validateNumber(a) + validateNumber(b),
        [a, b]
    );

const subtract = ([a, b]) =>
    createNode(
        ([a, b]) => validateNumber(a) - validateNumber(b),
        [a, b]
    );

const multiply = ([a, b]) =>
    createNode(
        ([a, b]) => validateNumber(a) * validateNumber(b),
        [a, b]
    );

const divide = ([a, b]) =>
    createNode(
        ([a, b]) => {
            const divisor = validateNumber(b);
            if (divisor === 0) throw new TypeError('Division by zero');
            return validateNumber(a) / divisor;
        },
        [a, b]
    );

const power = ([base, exponent]) =>
    createNode(
        ([base, exponent]) => Math.pow(validateNumber(base), validateNumber(exponent)),
        [base, exponent]
    );

// Trigonometric functions.
const sin = (x) =>
    createNode(
        (x) => Math.sin(validateNumber(x)),
        [x]
    );

const cos = (x) =>
    createNode(
        (x) => Math.cos(validateNumber(x)),
        [x]
    );

const tan = (x) =>
    createNode(
        (x) => Math.tan(validateNumber(x)),
        [x]
    );

const sqrt = (x) =>
    createNode(
        (x) => {
            const num = validateNumber(x);
            if (num < 0) throw new TypeError('Square root of negative number');
            return Math.sqrt(num);
        },
        [x]
    );

// --- Tuple/Vector Nodes ---
// You can rename "tuple" to "vector" if that fits your domain better.

// Creates a 2-element tuple (vector) node.
const tuple2 = ([x, y]) =>
    createNode(
        () => validateArray([x, y]),
        [x, y]
    );

// Creates a 3-element tuple (vector) node.
const tuple3 = ([x, y, z]) =>
    createNode(
        () => validateArray([x, y, z]),
        [x, y, z]
    );

// --- Vector (Tuple) Operations ---

// Adds two vectors (of equal length).
const vectorAdd = ([vecA, vecB]) =>
    createNode(
        ([vecA, vecB]) => {
            const a = validateArrayNumbers(vecA);
            const b = validateArrayNumbers(vecB);
            if (a.length !== b.length)
                throw new TypeError('Vectors must have the same length');
            return a.map((val, idx) => val + b[idx]);
        },
        [vecA, vecB]
    );

// Subtracts two vectors (of equal length).
const vectorSubtract = ([vecA, vecB]) =>
    createNode(
        ([vecA, vecB]) => {
            const a = validateArrayNumbers(vecA);
            const b = validateArrayNumbers(vecB);
            if (a.length !== b.length)
                throw new TypeError('Vectors must have the same length');
            return a.map((val, idx) => val - b[idx]);
        },
        [vecA, vecB]
    );

// Dot product of two vectors (of equal length).
const dot = ([vecA, vecB]) =>
    createNode(
        ([vecA, vecB]) => {
            const a = validateArrayNumbers(vecA);
            const b = validateArrayNumbers(vecB);
            if (a.length !== b.length)
                throw new TypeError('Vectors must have the same length');
            return a.reduce((acc, cur, idx) => acc + cur * b[idx], 0);
        },
        [vecA, vecB]
    );

// Cross product of two 3D vectors.
const cross = ([vecA, vecB]) =>
    createNode(
        ([vecA, vecB]) => {
            const a = validateArrayNumbers(vecA);
            const b = validateArrayNumbers(vecB);
            if (a.length !== 3 || b.length !== 3)
                throw new TypeError('Cross product is only defined for 3D vectors');
            return [
                a[1] * b[2] - a[2] * b[1],
                a[2] * b[0] - a[0] * b[2],
                a[0] * b[1] - a[1] * b[0]
            ];
        },
        [vecA, vecB]
    );

// --- Exporting the nodes ---

export {
    number,
    add,
    subtract,
    multiply,
    divide,
    power,
    sin,
    cos,
    tan,
    sqrt,
    tuple2,
    tuple3,
    vectorAdd,
    vectorSubtract,
    dot,
    cross
};


// --- Vector Constructors ---

// Creates a 2D vector node from two numbers.
const vector2 = tuple2;

// Creates a 3D vector node from three numbers.
const vector3 = tuple3;

// --- Vector2 Operations ---

// Adds two 2D vectors.
const add2 = ([vecA, vecB]) =>
    createNode(
        ([vecA, vecB]) => {
            const a = validateArrayNumbers(vecA);
            const b = validateArrayNumbers(vecB);
            if (a.length !== 2 || b.length !== 2)
                throw new TypeError('Both inputs must be 2D vectors');
            return [a[0] + b[0], a[1] + b[1]];
        },
        [vecA, vecB]
    );

// Subtracts two 2D vectors.
const subtract2 = ([vecA, vecB]) =>
    createNode(
        ([vecA, vecB]) => {
            const a = validateArrayNumbers(vecA);
            const b = validateArrayNumbers(vecB);
            if (a.length !== 2 || b.length !== 2)
                throw new TypeError('Both inputs must be 2D vectors');
            return [a[0] - b[0], a[1] - b[1]];
        },
        [vecA, vecB]
    );

// Scales a 2D vector by a scalar.
const scale2 = ([vec, scalar]) =>
    createNode(
        ([vec, scalar]) => {
            const a = validateArrayNumbers(vec);
            if (a.length !== 2)
                throw new TypeError('Expected a 2D vector');
            const s = Number(scalar);
            if (isNaN(s))
                throw new TypeError('Expected a valid number for scalar');
            return [a[0] * s, a[1] * s];
        },
        [vec, scalar]
    );

// Dot product of two 2D vectors.
const dot2 = ([vecA, vecB]) =>
    createNode(
        ([vecA, vecB]) => {
            const a = validateArrayNumbers(vecA);
            const b = validateArrayNumbers(vecB);
            if (a.length !== 2 || b.length !== 2)
                throw new TypeError('Both inputs must be 2D vectors');
            return a[0] * b[0] + a[1] * b[1];
        },
        [vecA, vecB]
    );

// Magnitude (length) of a 2D vector.
const magnitude2 = (vec) =>
    createNode(
        (vec) => {
            const a = validateArrayNumbers(vec);
            if (a.length !== 2)
                throw new TypeError('Expected a 2D vector');
            return Math.hypot(a[0], a[1]);
        },
        [vec]
    );

// Normalizes a 2D vector.
const normalize2 = (vec) =>
    createNode(
        (vec) => {
            const a = validateArrayNumbers(vec);
            if (a.length !== 2)
                throw new TypeError('Expected a 2D vector');
            const mag = Math.hypot(a[0], a[1]);
            if (mag === 0)
                throw new TypeError('Cannot normalize a zero vector');
            return [a[0] / mag, a[1] / mag];
        },
        [vec]
    );

// --- Vector3 Operations ---

// Adds two 3D vectors.
const add3 = ([vecA, vecB]) =>
    createNode(
        ([vecA, vecB]) => {
            const a = validateArrayNumbers(vecA);
            const b = validateArrayNumbers(vecB);
            if (a.length !== 3 || b.length !== 3)
                throw new TypeError('Both inputs must be 3D vectors');
            return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
        },
        [vecA, vecB]
    );

// Subtracts two 3D vectors.
const subtract3 = ([vecA, vecB]) =>
    createNode(
        ([vecA, vecB]) => {
            const a = validateArrayNumbers(vecA);
            const b = validateArrayNumbers(vecB);
            if (a.length !== 3 || b.length !== 3)
                throw new TypeError('Both inputs must be 3D vectors');
            return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
        },
        [vecA, vecB]
    );

// Scales a 3D vector by a scalar.
const scale3 = ([vec, scalar]) =>
    createNode(
        ([vec, scalar]) => {
            const a = validateArrayNumbers(vec);
            if (a.length !== 3)
                throw new TypeError('Expected a 3D vector');
            const s = Number(scalar);
            if (isNaN(s))
                throw new TypeError('Expected a valid number for scalar');
            return [a[0] * s, a[1] * s, a[2] * s];
        },
        [vec, scalar]
    );

// Dot product of two 3D vectors.
const dot3 = ([vecA, vecB]) =>
    createNode(
        ([vecA, vecB]) => {
            const a = validateArrayNumbers(vecA);
            const b = validateArrayNumbers(vecB);
            if (a.length !== 3 || b.length !== 3)
                throw new TypeError('Both inputs must be 3D vectors');
            return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        },
        [vecA, vecB]
    );

// Magnitude (length) of a 3D vector.
const magnitude3 = (vec) =>
    createNode(
        (vec) => {
            const a = validateArrayNumbers(vec);
            if (a.length !== 3)
                throw new TypeError('Expected a 3D vector');
            return Math.hypot(a[0], a[1], a[2]);
        },
        [vec]
    );

// Normalizes a 3D vector.
const normalize3 = (vec) =>
    createNode(
        (vec) => {
            const a = validateArrayNumbers(vec);
            if (a.length !== 3)
                throw new TypeError('Expected a 3D vector');
            const mag = Math.hypot(a[0], a[1], a[2]);
            if (mag === 0)
                throw new TypeError('Cannot normalize a zero vector');
            return [a[0] / mag, a[1] / mag, a[2] / mag];
        },
        [vec]
    );

export {
    vector2,
    vector3,
    add2,
    subtract2,
    scale2,
    dot2,
    magnitude2,
    normalize2,
    add3,
    subtract3,
    scale3,
    dot3,
    magnitude3,
    normalize3
};

