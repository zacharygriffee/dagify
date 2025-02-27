# diff Getter

The `diff` getter is a composite node property that applies the `diffOperator` to the observable stream using the `pipe` method. This property allows subscribers to receive a stream of diff objects representing incremental changes between successive array emissions.

## How It Works

- **Observable Transformation:**  
  The getter applies the `diffOperator` to the current observable, transforming each emission into an array of diff objects.

- **Diff Objects:**  
  Each diff object indicates:
    - Items added (`{ type: 'new', values: [...] }`)
    - Items removed (`{ type: 'del', values: [...] }`)

## Example Usage

```javascript
// Assuming the composite node has an observable property
// and a getter defined as follows:
get diff() {
    return this.pipe(diffOperator());
}

// Subscribe to the diff stream
compositeNode.diff.subscribe(diff => {
    console.log('Diff emitted:', diff);
});
```

# diffOperator

`diffOperator` is an RxJS operator that compares consecutive array emissions and emits the differences. For each pair of arrays, it detects:

- **Added items:** Items present in the new array but not in the previous one. Emitted as an object with `type: 'new'`.
- **Removed items:** Items present in the previous array but missing in the new one. Emitted as an object with `type: 'del'`.

## How It Works

- **Pairwise Comparison:**  
  Uses the `pairwise` operator to get the previous and current arrays.

- **Diff Calculation:**  
  Filters the arrays to find which items were added or removed.

- **Emission:**  
  Emits diff objects for any added or removed items.

## API

### `diffOperator()`

- **Returns:**  
  An RxJS operator function that transforms a stream of arrays into a stream of diff objects:
  ```js
  { type: 'new' | 'del', values: Array }
  ```

## Example Usage

```javascript
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { diffOperator } from './path/to/diffOperator';

const source$ = of(
  [1, 2, 3],
  [1, 2, 3, 4],
  [1, 3, 4]
).pipe(delay(1000));

source$.pipe(diffOperator()).subscribe(diff => console.log(diff));
```

In the above example:
- When transitioning from `[1, 2, 3]` to `[1, 2, 3, 4]`, the operator emits:
  ```js
  { type: 'new', values: [4] }
  ```
- When transitioning from `[1, 2, 3, 4]` to `[1, 3, 4]`, the operator emits:
  ```js
  { type: 'del', values: [2] }
  ```

This concise operator is ideal for tracking incremental changes in a stream of arrays.
