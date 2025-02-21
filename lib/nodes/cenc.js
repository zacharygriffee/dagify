import c from "compact-encoding";
import {createNode} from "../../index.secure.js";
import {validateBuffer} from "./validations.js";

const encoder = (encoding, source) => createNode(
    source => c.encode(c.from(encoding), source),
    source
);

const decoder = (encoding, source) => createNode(
    source => c.decode(c.from(encoding), validateBuffer(source)),
    source
);

export {
    encoder,
    decoder
}