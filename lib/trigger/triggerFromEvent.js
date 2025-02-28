import {isEventEmitter, isEventTarget} from "../util/isEventEmitter.js";
import {trigger} from "./trigger.js";
import {fromEvent, share} from "rxjs";

const triggerFromEvent = (source, eventName, config) => {
    if (isEventEmitter(source) || isEventTarget(source)) {
        return trigger(fromEvent(source, eventName), config);
    }
    throw new Error("triggerFromEvent must be an EventEmitter or event target.");
}

export { triggerFromEvent };