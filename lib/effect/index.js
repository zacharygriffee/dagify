import { createCommandNode } from "../command-node/index.js";
import { createBridgeNode } from "../bridge-node/index.js";
import { createSinkNode } from "../sink-node/index.js";
import { createEventNode } from "../event/index.js";
import { trigger, createTrigger } from "../trigger/index.js";
import { dispatcher } from "../dispatcher/index.js";
import { invokeOnNode } from "./invokeOnNode.js";

const command = (name, handler, config, context) =>
    createCommandNode(name, handler, config, context);

const bridge = (input, output, config) =>
    createBridgeNode(input, output, config);

const sink = (fnOrValue, dependencies, config) =>
    createSinkNode(fnOrValue, dependencies, config);

const fromEvent = (eventName, defaultValue, context) =>
    createEventNode(eventName, defaultValue, context);

const effect = {
    command,
    bridge,
    sink,
    invokeOnNode,
    fromEvent,
    trigger,
    createTrigger,
    dispatcher
};

export {
    effect,
    command,
    bridge,
    sink,
    invokeOnNode,
    fromEvent,
    trigger,
    createTrigger,
    dispatcher
};
