function randomBytes(length) {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
}

function keyGenerator() {
    return randomBytes(32);
}

// Ensure the dagify namespace exists, then only assign keyGenerator if it's not already defined
globalThis.dagify = globalThis.dagify || {};
if (!globalThis.dagify.keyGenerator) {
    globalThis.dagify.keyGenerator = keyGenerator;
    globalThis.dagify.keyGeneratorSecure = false;
}

export const useKeyGenerator = (generator) => globalThis.dagify.keyGenerator = generator;