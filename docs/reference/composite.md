# Composite Nodes

`createComposite` groups multiple nodes and emits aggregated snapshots whenever any child emits.

```js
import { createComposite, createNode } from "dagify";

const width = createNode(100);
const height = createNode(200);
const area = createNode(([w, h]) => w * h, [width, height]);

const layout = createComposite({ width, height, area });
layout.subscribe(current => console.log("Layout snapshot:", current));

const palette = createComposite([createNode("red"), createNode("blue")]);
palette.subscribe(colors => console.log("Palette:", colors));
```

Behavior:
- Object form preserves keys; array form preserves ordering.
- Emissions occur when **any** child node emits; composite values mirror the child shapes.
- Composites themselves are Dagify nodes, so you can depend on them from other nodes or FRP helpers.

Tips:
- Use composites to pass structured props into components or to snapshot related state for logging/analytics.
- Combine with shallow/reference nodes when you want to control emission sensitivity of individual fields.
