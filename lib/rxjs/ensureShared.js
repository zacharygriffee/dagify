import {share, shareReplay} from 'rxjs';

function ensureShared(obs) {
    // Wrap if it isn’t a subject-like observable with a complete method
    if (!obs.subscribe || !obs.complete) {
        return obs;
    }
    // Here, shareReplay(1) ensures the observable stays hot and replays the last value
    return obs.pipe(share());
}

export { ensureShared };