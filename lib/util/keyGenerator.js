import z32 from "z32";
import crypto from "hypercore-crypto";
let keyGenerator;
keyGenerator = () => crypto.randomBytes(32);
const keyToZ32 = key => z32.encode(key);
const z32ToKey = z32Key => z32.decode(z32Key);

export { keyGenerator, keyToZ32, z32ToKey }