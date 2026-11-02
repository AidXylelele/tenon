import type { WorkerRunKind } from './enums.js';

export interface WorkerPoolOptions {
  // `import.meta.url` of the client, beside which its worker lies.
  readonly moduleUrl: string;
  // The worker's file name without its extension.
  readonly worker: string;
  readonly maxThreads: number;
  // The heap a worker may grow to; null: Node's default.
  readonly heapMb: number | null;
}

export interface WorkerDone<R> {
  readonly kind: WorkerRunKind.Done;
  readonly result: R;
}

export interface WorkerTimedOut {
  readonly kind: WorkerRunKind.TimedOut;
}

export interface WorkerExhausted {
  readonly kind: WorkerRunKind.Exhausted;
}

export type WorkerRun<R> = WorkerDone<R> | WorkerTimedOut | WorkerExhausted;
