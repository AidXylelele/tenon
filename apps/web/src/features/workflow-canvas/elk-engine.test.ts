import { describe, expect, it, vi } from 'vitest';
import { elkEngine } from './elk-engine';

interface EngineOptions {
  readonly algorithms: readonly string[];
  readonly workerFactory: () => unknown;
}

interface StartedWorker {
  readonly url: URL;
  readonly options: WorkerOptions;
}

const engines: EngineOptions[] = [];
const workers: StartedWorker[] = [];

// ELK's API, reduced to the options it is made with.
vi.mock('elkjs/lib/elk-api', () => ({
  default: class {
    constructor(options: EngineOptions) {
      engines.push(options);
    }
  },
}));

// The browser's worker, reduced to the script and options it starts with.
vi.stubGlobal(
  'Worker',
  class {
    constructor(url: URL, options: WorkerOptions) {
      workers.push({ url, options });
    }
  },
);

describe('the layout engine of the page', () => {
  it('one_engine_serves_every_canvas_and_lays_out_in_layers', async () => {
    const first = elkEngine();
    const second = elkEngine();
    await first;

    expect(second).toBe(first);
    expect(engines).toHaveLength(1);
    expect(engines[0]?.algorithms).toEqual(['layered']);
  });

  it('it_lays_out_off_the_drawing_thread_in_the_canvas_worker_script', async () => {
    await elkEngine();

    engines[0]?.workerFactory();

    expect(workers).toHaveLength(1);
    expect(workers[0]?.url.pathname).toMatch(/\/elk\.worker\.ts$/);
    expect(workers[0]?.options).toEqual({ type: 'module' });
  });
});
