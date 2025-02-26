function isEventTarget(obj) {
    return obj &&
        typeof obj.addEventListener === 'function' &&
        typeof obj.removeEventListener === 'function' &&
        typeof obj.dispatchEvent === 'function';
}

function isEventEmitter(obj) {
    return obj &&
        typeof obj.on === 'function' &&
        typeof obj.emit === 'function';
}

export { isEventEmitter, isEventTarget }
