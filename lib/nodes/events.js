import {fromEvent as _fromEvent} from "rxjs";
import {createNode, takeUntilCompleted} from "../../index.js";

const eventListenerNode = (subject, event) => {
    const e = createNode(result => result);
    e.addDependency(_fromEvent(subject, event).pipe(takeUntilCompleted(e)));
    return e;
}
const eventEmitterNode = (subject, event, dependencies) => createNode(values => subject.emit(event, values), dependencies);
export { eventListenerNode, eventEmitterNode };