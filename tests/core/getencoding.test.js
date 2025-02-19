import { solo, test } from "brittle";
import {getEncoder} from "../../lib/util/getEncoder.js";
import cenc from "compact-encoding";

test("getEncoding works properly", t => {
    const encoder = getEncoder("utf8");
    const x = cenc.decode(encoder, cenc.encode(encoder, "hello world"));
    t.is(x, "hello world");
});

test("getEncoding array works properly", t => {
    const encoder = getEncoder("array(utf8)");

    const x = cenc.decode(encoder, cenc.encode(encoder, ["hello", "world"]));
    t.alike(x, ["hello", "world"]);
});

test("getEncoding fixed works properly", t => {
    const encoder = getEncoder("string.fixed(4)");
    const x = cenc.decode(encoder, cenc.encode(encoder, "hello"));
    t.is(x, "hell");
});