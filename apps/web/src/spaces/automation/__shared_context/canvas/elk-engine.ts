import type { ELK } from 'elkjs/lib/elk-api';

let engine: Promise<ELK> | null = null;

// One ELK for every canvas of the page, loaded with the first one and laying out in a worker,
// off the thread that draws (research R16).
export function elkEngine(): Promise<ELK> {
  engine ??= load();
  return engine;
}

async function load(): Promise<ELK> {
  const { default: ElkApi } = await import('elkjs/lib/elk-api');
  return new ElkApi({
    algorithms: ['layered'],
    workerFactory: () =>
      new Worker(new URL('./elk.worker.ts', import.meta.url), {
        type: 'module',
      }),
  });
}
