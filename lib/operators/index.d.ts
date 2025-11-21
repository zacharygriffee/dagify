import type { Observable, OperatorFunction } from "rxjs";

export type { OperatorFunction } from "rxjs";

export declare function takeUntilCompleted<T>(
  notifier: Observable<unknown> | (() => Observable<unknown>)
): OperatorFunction<T, T>;

export interface DiffOperatorOptions<T> {
  initial?: boolean;
  eq?: (a: T, b: T) => boolean;
}

export interface ArrayDiff<T> {
  new?: T[];
  del?: T[];
  same?: T[];
}

export declare function diffOperator<T>(
  options?: DiffOperatorOptions<T>
): OperatorFunction<T[], ArrayDiff<T>>;
