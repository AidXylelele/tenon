import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ResiliencePolicy,
  ResilienceTimeoutError,
} from '@nestjs/resilience';
import { Piscina } from 'piscina';
import { WorkerRunKind } from './enums.js';
import type { WorkerPoolOptions, WorkerRun } from './interfaces.js';

// A Piscina pool whose runs a resilience preset bounds: the preset's timeout aborts a run and
// Piscina terminates its worker, and a worker that outgrows its heap ends, so a runaway program
// or document gives its thread back. Idle workers beyond one stop after 30 s.
export class WorkerPool<T, R> {
  static readonly #IDLE_MS = 30_000;
  static readonly #OUT_OF_MEMORY = 'ERR_WORKER_OUT_OF_MEMORY';

  readonly #pool: Piscina<T, R>;
  readonly #policy: ResiliencePolicy;

  constructor(policy: ResiliencePolicy, options: WorkerPoolOptions) {
    // `.ts` where the sources run (tests), `.js` in the build.
    const extension = extname(fileURLToPath(options.moduleUrl));
    const worker = `./${options.worker}${extension}`;
    const filename = new URL(worker, options.moduleUrl).href;
    const resourceLimits = WorkerPool.#limitsOf(options.heapMb);
    this.#pool = new Piscina<T, R>({
      filename,
      minThreads: 1,
      maxThreads: options.maxThreads,
      idleTimeout: WorkerPool.#IDLE_MS,
      resourceLimits,
    });
    this.#policy = policy;
  }

  async run(task: T): Promise<WorkerRun<R>> {
    try {
      const result = await this.#policy.execute(({ signal }) =>
        this.#pool.run(task, { signal }),
      );
      return { kind: WorkerRunKind.Done, result };
    } catch (error) {
      if (error instanceof ResilienceTimeoutError)
        return { kind: WorkerRunKind.TimedOut };

      const exhausted =
        error instanceof Error &&
        Reflect.get(error, 'code') === WorkerPool.#OUT_OF_MEMORY;

      if (exhausted) return { kind: WorkerRunKind.Exhausted };

      throw error;
    }
  }

  close(): Promise<void> {
    return this.#pool.close();
  }

  static #limitsOf(
    heapMb: number | null,
  ): { maxOldGenerationSizeMb: number } | undefined {
    if (heapMb === null) return undefined;

    return { maxOldGenerationSizeMb: heapMb };
  }
}
