
/**
 * Custom RxJS `map` operator implementation.
 *
 * @param {Function} project - The transformation function applied to each value.
 * @returns {Function} A function that takes an observable and returns a new transformed observable.
 */
function map(project) {
    return function mapOperator(sourceObservable) {
        return {
            subscribe(observer) {
                return sourceObservable.subscribe({
                    next(value) {
                        try {
                            const newValue = project(value);
                            observer.next?.(newValue);
                        } catch (err) {
                            observer.error?.(err);
                        }
                    },
                    error(err) {
                        observer.error?.(err);
                    },
                    complete() {
                        observer.complete?.();
                    }
                });
            }
        };
    };
}

export { map }