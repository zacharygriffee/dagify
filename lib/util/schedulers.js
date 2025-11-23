const syncScheduler = {
    schedule(fn) {
        fn();
    }
};

const microtaskScheduler = {
    schedule(fn) {
        queueMicrotask(fn);
    }
};

const createMessageChannelScheduler = () => {
    if (typeof MessageChannel !== "function") {
        return null;
    }
    let channel = null;
    let queue = null;
    return {
        schedule(fn) {
            if (!channel) {
                channel = new MessageChannel();
                queue = [];
                channel.port1.onmessage = () => {
                    const next = queue.shift();
                    if (next) next();
                };
                // Prevent the MessageChannel from keeping Node's event loop alive
                if (typeof channel.port1.unref === "function") {
                    channel.port1.unref();
                    channel.port2.unref();
                }
            }
            queue.push(fn);
            channel.port2.postMessage(null);
        }
    };
};

const messageChannelScheduler = createMessageChannelScheduler();

const timeoutScheduler = {
    schedule(fn) {
        setTimeout(fn, 0);
    }
};

const immediateScheduler = typeof setImmediate === "function" ? {
    schedule(fn) {
        setImmediate(fn);
    }
} : null;

const defaultSchedulers = {
    update: microtaskScheduler,
    notify: microtaskScheduler
};

let globalSchedulers = { ...defaultSchedulers };

const setSchedulers = (opts = {}) => {
    if (opts.updateScheduler) globalSchedulers.update = opts.updateScheduler;
    if (opts.notifyScheduler) globalSchedulers.notify = opts.notifyScheduler;
};

const getSchedulers = () => globalSchedulers;

const schedulerPresets = {
    sync: syncScheduler,
    microtask: microtaskScheduler,
    messageChannel: messageChannelScheduler || microtaskScheduler,
    timeout: timeoutScheduler,
    immediate: immediateScheduler || microtaskScheduler
};

export {
    schedulerPresets,
    setSchedulers,
    getSchedulers
};
