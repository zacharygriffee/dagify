import crypto from 'hypercore-crypto';

function keyGenerator() {
    return crypto.randomBytes(32)
}

// Ensure the dagify namespace exists, then only assign keyGenerator if it's not already defined
globalThis.dagify = globalThis.dagify || {};
if (!globalThis.dagify.keyGenerator) {
    globalThis.dagify.keyGenerator = keyGenerator;
}