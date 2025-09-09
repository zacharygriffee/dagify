import b4a from "b4a";

// z‑base‑32 alphabet (designed for human friendliness)
const ALPHABET = 'ybndrfg8ejkmcpqxot1uwisza345h769';

// Build a reverse lookup table for decoding.
const CHAR_MAP = {};
for (let i = 0; i < ALPHABET.length; i++) {
    CHAR_MAP[ALPHABET[i]] = i;
}

/**
 * Encodes a Uint8Array into a z32 encoded string.
 * @param {Uint8Array} inputBuffer - The input buffer to encode.
 * @returns {string} - The z32 encoded string.
 */
function encode(inputBuffer) {
    let bits = 0;
    let bitsLength = 0;
    let output = '';

    // Process each byte from the input buffer.
    for (let i = 0; i < inputBuffer.length; i++) {
        // Append 8 bits from the byte.
        bits = (bits << 8) | inputBuffer[i];
        bitsLength += 8;

        // Process as many 5-bit groups as possible.
        while (bitsLength >= 5) {
            bitsLength -= 5;
            const index = (bits >> bitsLength) & 0x1F; // extract top 5 bits
            output += ALPHABET[index];
        }
    }

    // If there are leftover bits, pad them to form a 5-bit group.
    if (bitsLength > 0) {
        const index = (bits << (5 - bitsLength)) & 0x1F;
        output += ALPHABET[index];
    }

    return output;
}

/**
 * Decodes a z32 encoded string back into a Uint8Array.
 * @param {string} inputString - The z32 encoded string.
 * @returns {Uint8Array} - The decoded buffer.
 */
function decode(inputString) {
    let bits = 0;
    let bitsLength = 0;
    const bytes = [];

    // Process each character from the input string.
    for (let i = 0; i < inputString.length; i++) {
        const char = inputString[i];
        if (!(char in CHAR_MAP)) {
            throw new Error(`Invalid character found in input: ${char}`);
        }
        // Append 5 bits from the current character.
        bits = (bits << 5) | CHAR_MAP[char];
        bitsLength += 5;

        // Whenever we have 8 or more bits, extract a byte.
        if (bitsLength >= 8) {
            bitsLength -= 8;
            const byte = (bits >> bitsLength) & 0xFF;
            bytes.push(byte);
        }
    }

    // Create a buffer from the array of bytes using b4a.
    return b4a.from(bytes);
}

export { encode, decode }