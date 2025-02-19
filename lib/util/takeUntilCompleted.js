import { Observable } from 'rxjs';

/**
 * Custom operator that completes the source observable when the notifier observable completes.
 * @param {Observable<any>|Function} notifier - The observable whose completion will trigger the source to complete.
 * @returns {function(source: Observable<T>): Observable<T>} - An operator function.
 */
function takeUntilCompleted(notifier) {
    return function(source) {
        if (typeof notifier === "function") notifier = notifier();
        return new Observable(subscriber => {
            // Subscribe to the notifier.
            const notifierSubscription = notifier.subscribe({
                // When the notifier completes, complete the subscriber.
                complete: () => {
                    subscriber.complete();
                },
                error: err => {
                    subscriber.error(err);
                }
            });

            // Subscribe to the source observable.
            const sourceSubscription = source.subscribe({
                next: (value) => subscriber.next(value),
                error: (err) => subscriber.error(err),
                complete: () => subscriber.complete()
            });

            // Return a teardown function that unsubscribes both.
            return () => {
                notifierSubscription.unsubscribe();
                sourceSubscription.unsubscribe();
            };
        });
    };
}

export { takeUntilCompleted };
