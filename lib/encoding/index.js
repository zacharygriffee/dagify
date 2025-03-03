import {getEncoder} from "./getEncoder.js";
import cenc from "compact-encoding";


const encodeValue = (value, encoder) => cenc.encode(getEncoder(encoder), value)
const decodeValue = (value, encoder) => cenc.decode(getEncoder(encoder), value)

export { encodeValue, decodeValue }