// tests/types.test.js
import test, {solo} from 'brittle';
import b4a from 'b4a'
import {getType, setType, types} from "../../lib/types/index.js";
import {createNode, NO_EMIT} from "../../lib/node/index.js";
import {sleep} from "../helpers/sleep.js";

// Helper function to get a validator from the registry.
const v = typeName => types.getType(typeName)

test('any type always passes', t => {
    t.ok(v('any')(123), 'any accepts a number')
    t.ok(v('any')(null), 'any accepts null')
    t.ok(v('any')({}), 'any accepts an object')
})

test('number type validation', t => {
    t.ok(v('number')(3.14), 'number accepts 3.14')
    t.absent(v('number')('3.14'), 'number rejects string')
})

test('string type validation', t => {
    t.ok(v('string')('hello'), 'string accepts "hello"')
    t.absent(v('string')(123), 'string rejects number')
})

test('boolean type validation', t => {
    t.ok(v('boolean')(true), 'boolean accepts true')
    t.absent(v('boolean')('false'), 'boolean rejects string')
})

test('object type validation', t => {
    t.ok(v('object')({ a: 1 }), 'object accepts plain object')
    t.absent(v('object')(null), 'object rejects null')
    t.absent(v('object')([]), 'object rejects arrays')
})

test('array type validation', t => {
    t.ok(v('array')([1,2,3]), 'array accepts an array')
    t.absent(v('array')({}), 'array rejects object')
})

test('function type validation', t => {
    t.ok(v('function')(() => {}), 'function accepts a function')
    t.absent(v('function')('fn'), 'function rejects non-function')
})

test('int type validation', t => {
    t.ok(v('int')(42), 'int accepts 42')
    t.absent(v('int')(3.14), 'int rejects float')
    t.absent(v('int')('42'), 'int rejects string')
})

test('uint type validation', t => {
    t.ok(v('uint')(0), 'uint accepts 0')
    t.ok(v('uint')(100), 'uint accepts positive int')
    t.absent(v('uint')(-1), 'uint rejects negative')
})

test('int8 type validation', t => {
    t.ok(v('int8')(127), 'int8 accepts 127')
    t.ok(v('int8')(-128), 'int8 accepts -128')
    t.absent(v('int8')(128), 'int8 rejects 128')
    t.absent(v('int8')(-129), 'int8 rejects -129')
})

test('uint8 type validation', t => {
    t.ok(v('uint8')(0), 'uint8 accepts 0')
    t.ok(v('uint8')(255), 'uint8 accepts 255')
    t.absent(v('uint8')(-1), 'uint8 rejects negative')
    t.absent(v('uint8')(256), 'uint8 rejects 256')
})

test('int16 type validation', t => {
    t.ok(v('int16')(32767), 'int16 accepts 32767')
    t.ok(v('int16')(-32768), 'int16 accepts -32768')
    t.absent(v('int16')(32768), 'int16 rejects 32768')
})

test('uint16 type validation', t => {
    t.ok(v('uint16')(0), 'uint16 accepts 0')
    t.ok(v('uint16')(65535), 'uint16 accepts 65535')
    t.absent(v('uint16')(-1), 'uint16 rejects negative')
    t.absent(v('uint16')(65536), 'uint16 rejects 65536')
})

test('int32 type validation', t => {
    t.ok(v('int32')(2147483647), 'int32 accepts max int32')
    t.ok(v('int32')(-2147483648), 'int32 accepts min int32')
    t.absent(v('int32')(2147483648), 'int32 rejects overflow')
})

test('uint32 type validation', t => {
    t.ok(v('uint32')(0), 'uint32 accepts 0')
    t.ok(v('uint32')(4294967295), 'uint32 accepts max uint32')
    t.absent(v('uint32')(-1), 'uint32 rejects negative')
    t.absent(v('uint32')(4294967296), 'uint32 rejects overflow')
})

test('int64 type validation', t => {
    // For int64, allow numbers if within safe range or BigInts.
    t.ok(v('int64')(9007199254740991), 'int64 accepts MAX_SAFE_INTEGER')
    t.ok(v('int64')(BigInt('-9223372036854775808')), 'int64 accepts bigint min')
    t.ok(v('int64')(BigInt('9223372036854775807')), 'int64 accepts bigint max')
    t.absent(v('int64')(9007199254740992), 'int64 rejects unsafe number beyond MAX_SAFE_INTEGER')
})

test('uint64 type validation', t => {
    t.ok(v('uint64')(0), 'uint64 accepts 0')
    t.ok(v('uint64')(BigInt('18446744073709551615')), 'uint64 accepts a large bigint')
    t.absent(v('uint64')(-1), 'uint64 rejects negative')
})

test('float32 type validation', t => {
    t.ok(v('float32')(Math.fround(3.14)), 'float32 accepts fround value')
    t.absent(v('float32')(3.14), 'float32 rejects non-fround value if different')
})

test('float64 type validation', t => {
    t.ok(v('float64')(3.14), 'float64 accepts any number')
    t.absent(v('float64')('3.14'), 'float64 rejects string')
})

test('buffer type validation', t => {
    const buf = b4a.alloc(10)
    t.ok(v('buffer')(buf), 'buffer accepts a valid buffer')
    t.absent(v('buffer')('not a buffer'), 'buffer rejects non-buffer')
})

test('binary type validation (alias for buffer)', t => {
    const buf = b4a.alloc(5)
    t.ok(v('binary')(buf), 'binary accepts a valid buffer')
    t.absent(v('binary')(12345), 'binary rejects non-buffer')
})

test("setType and getType flow", async t => {
    const node = setType(createNode(), "string");
    const type = getType(node);
    await node.set(1234);
    await sleep();
    t.ok(node.value === NO_EMIT);
    t.is(type, "string");
});

test("Ability to pass a validator function as the type", async t => {
    const node = setType(createNode(), value => typeof value === "string");
    t.absent(node.set(1234));
    t.ok(node.set("hello"));
    t.ok(typeof node.type === "function");
});
