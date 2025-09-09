import b4a from "b4a";

// Unsafe randomBytes, import a safer one if that is important to you.
function randomBytes(length) {
    const bytes = b4a.alloc(length);
    for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
}

export function defaultKeyGenerator() {
    return randomBytes(32);
}