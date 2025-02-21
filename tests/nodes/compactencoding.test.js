import {decoder, encoder} from "../../lib/nodes/cenc.js";
import {test, solo,skip} from "brittle";
import {createNode} from "../../index.secure.js";
import cenc from "compact-encoding";
import b4a from "b4a";

test("cenc encode/decode", async t => {
    const number = createNode(10);
    const encNode = encoder(cenc.uint8, number);
    t.ok(b4a.equals(cenc.encode(cenc.uint8, 10), encNode.value), "Encoded value is equal to the original value");
    await number.set(20);
    t.ok(b4a.equals(cenc.encode(cenc.uint8, 20), encNode.value), "Encoded value is equal to the original value after updating the node")
    const decNode = decoder(cenc.uint8, encNode);
    t.is(decNode.value, 20, "Decoded value is equal to the original value");
});