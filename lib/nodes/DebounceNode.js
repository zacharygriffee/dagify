// import {ReactiveNode} from "../ReactiveNode.js";
// import {debounceTime} from "../rxjs/rxjsPrebuilt.js";
//
// class DebouncedNode extends ReactiveNode {
//     /**
//      * Creates a debounced version of the source node.
//      * @param {ReactiveNode} source - The source node to debounce.
//      * @param {number} delay - The debounce delay in milliseconds.
//      */
//     constructor(source, delay) {
//         // Here, we create a computed node that simply wraps the source node's observable with debounce.
//         super(([value]) => value, [source]);
//         this.source = source;
//         // Override toObservable to add debounceTime.
//         this.toObservable = () => source.toObservable().pipe(debounceTime(delay));
//     }
// }