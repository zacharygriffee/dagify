# Reference Nodes

`createReferenceNode` treats every update as a simple `===` comparison and emits only when the reference changes.

```js
import { createReferenceNode } from "dagify";

const seat = createReferenceNode({ id: 1 });
seat.subscribe(ref => console.log("seat updated", ref.id));

const sameSeat = seat.value;
seat.set(sameSeat);      // no emission (same reference)
seat.set({ id: 1 });     // emits (new object)
```

Use cases:
- Preserve reference churn (e.g., identity-sensitive downstream consumers).
- Skip deep/shallow comparisons entirely for performance or semantics.

Notes:
- Accepts dependencies/config like `createNode`, so you can build computed reference nodes.
- Pair with `createShallowNode` when you want light structural checks instead of pure reference checks.
