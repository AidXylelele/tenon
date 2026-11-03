// Instances one engine worker runs at once; the pools that serve a run's work are sized by it.
export const ENGINE_CONCURRENCY = 10;

// The signal that resumes a suspended instance's run, keyed by the instance's id.
export const RESUME_SIGNAL = 'resume';

// The signal that carries an accepted event to a listening run, keyed by its listener.
export const EVENT_SIGNAL = 'event';
