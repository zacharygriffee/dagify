const setEncoding = (node, encoding) => {
    if (typeof encoding !== 'string') {
        throw new TypeError('encoding must be a string');
    }
    node.valueEncoding = encoding;
    return node;
}

const getEncoding = (node) => {
    return node.encoding || "any";
}

export { setEncoding, getEncoding };