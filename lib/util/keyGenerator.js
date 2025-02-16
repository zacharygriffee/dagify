import b4a from "b4a";
import z32 from "z32";
let keyGenerator;

if (typeof crypto !== "undefined" && typeof crypto.randomBytes === "function") {
    // Node.js environment: use the built-in crypto module.
    keyGenerator = () => crypto.randomBytes(32);
} else if (typeof window !== "undefined" && window.crypto && typeof window.crypto.getRandomValues === "function") {
    // Browser environment: use the Web Crypto API.
    keyGenerator = () => {
        const array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        return b4a.from(array);
    };
} else {
    // Fallback: non-secure generator.
    // This function produces an id that will fit in a 32-byte space.
    keyGenerator = () => b4a.from(`Node-${Math.random().toString(36).slice(2, 9)}`);
}

const keyToZ32 = key => z32.encode(key);
const z32ToKey = z32Key => z32.decode(z32Key);

export { keyGenerator, keyToZ32, z32ToKey }