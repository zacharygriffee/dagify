import cenc from "compact-encoding";
/**
 * Given a string like "string.fixed(10)", "raw.utf8", or "uint8",
 * this function returns the corresponding encoder from the global `cenc` object,
 * or null if not found.
 *
 * @param {string} encodingStr - The string representation of the encoding.
 * @param encoderLibrary
 * @returns {any|null} - The encoder corresponding to the string, or null if not found.
 */
function getEncoder(encodingStr, encoderLibrary = cenc) {
    // Optionally remove the "cenc." prefix if it exists.
    if (encodingStr.startsWith("cenc.")) {
        encodingStr = encodingStr.slice(5);
    }

    // Split the string on the dot separator.
    const parts = encodingStr.split(".");

    // Start with the global `cenc` object.
    let current = encoderLibrary;

    // Iterate through each part of the encoding string.
    for (const part of parts) {
        // Look for a potential function call, e.g., fixed(10)
        const funcMatch = part.match(/^([a-zA-Z0-9_]+)(?:\((.*)\))?$/);
        if (!funcMatch) {
            return null;
        }
        const name = funcMatch[1];
        const argsString = funcMatch[2];

        if (argsString !== undefined) {
            // Split and trim any arguments.
            const argValues = argsString.split(",").map(s => s.trim()).filter(s => s.length);
            // Convert numeric arguments if possible.
            const parsedArgs = argValues.map(arg => {
                const num = Number(arg);
                return isNaN(num) ? getEncoder(arg) : num;
            });
            // Ensure the property exists and is a function.
            if (typeof current[name] !== "function") {
                return null;
            }
            current = current[name](...parsedArgs);
        } else {
            // Otherwise, navigate directly to the next property.
            current = current[name];
            if (current === undefined) {
                return null;
            }
        }
    }
    return current;
}

export { getEncoder }