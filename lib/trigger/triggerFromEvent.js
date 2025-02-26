import {isEventEmitter, isEventTarget} from "../util/isEventEmitter.js";
import {fromEvent} from "../rxjs/rxjsPrebuilt.js";
import {trigger} from "./trigger.js";

const triggerFromEvent = (source, eventName, config) => {
    if (isEventEmitter(source) || isEventTarget(source)) {
        return trigger(fromEvent(source, eventName), config);
    }
    throw new Error("triggerFromEvent must be an EventEmitter or event target.");
}

export { triggerFromEvent };