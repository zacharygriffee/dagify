const setEncoding = (node, encoding) => {
    if (typeof encoding !== 'string') {
        throw new TypeError('encoding must be a string');
    }
    node.valueEncoding = encoding;
    return node;
}

const getEncoding = (node) => {
    if (!node || typeof node.valueEncoding === "undefined") {
        throw new Error("node must expose valueEncoding");
    }
    return node.valueEncoding ?? "any";
}

export { setEncoding, getEncoding };
