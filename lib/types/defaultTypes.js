import b4a from 'b4a'; // or your equivalent buffer utility

export const includeDefaultTypes = (types) => {

// Basic types
    types.registerType('number', value => typeof value === 'number');
    types.registerType('string', value => typeof value === 'string');
    types.registerType('boolean', value => typeof value === 'boolean');
    types.registerType('object', value =>
        value !== null && typeof value === 'object' && !Array.isArray(value)
    );
    types.registerType('array', Array.isArray);
    types.registerType('function', value => typeof value === 'function');

// Existing integer type
    types.registerType('int', value => Number.isInteger(value));

// Unsigned integer: integer and non-negative.
    types.registerType('uint', value =>
        Number.isInteger(value) && value >= 0
    );

// 8-bit integers.
    types.registerType('int8', value =>
        Number.isInteger(value) && value >= -128 && value <= 127
    );
    types.registerType('uint8', value =>
        Number.isInteger(value) && value >= 0 && value <= 255
    );

// 16-bit integers.
    types.registerType('int16', value =>
        Number.isInteger(value) && value >= -32768 && value <= 32767
    );
    types.registerType('uint16', value =>
        Number.isInteger(value) && value >= 0 && value <= 65535
    );

// 32-bit integers.
    types.registerType('int32', value =>
        Number.isInteger(value) && value >= -2147483648 && value <= 2147483647
    );
    types.registerType('uint32', value =>
        Number.isInteger(value) && value >= 0 && value <= 4294967295
    );

// 64-bit integers.
// For these, JavaScript numbers may not safely represent the full range.
// If you use BigInt, you could also adjust these validators accordingly.
    types.registerType('int64', value =>
        (typeof value === 'bigint') ||
        (Number.isSafeInteger(value) &&
            value >= -9223372036854775808 &&
            value <= 9223372036854775807)
    );
    types.registerType('uint64', value =>
        (typeof value === 'bigint') ||
        (Number.isInteger(value) &&
            value >= 0 &&
            value <= 9223372036854775807) // limited by Number.MAX_SAFE_INTEGER (2^53-1) in JS
    );

// Floating point types.
// For float32, we check that converting via Math.fround doesn't alter the value.
    types.registerType('float32', value =>
        typeof value === 'number' && Math.fround(value) === value
    );
// All JS numbers are float64.
    types.registerType('float64', value => typeof value === 'number');

// Binary / byte array (Uint8Array) type using b4a
    types.registerType('buffer', value => b4a.isBuffer(value));
// Optionally, allow an alias "binary" for buffer.
    types.registerType('binary', value => b4a.isBuffer(value));

}