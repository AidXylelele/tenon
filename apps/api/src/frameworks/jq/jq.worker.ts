import { type JqResult, loadJq } from 'jq-wasm';

export interface JqRun {
  readonly input: string | null;
  readonly query: string;
  readonly flags: string[];
}

export interface JqRunResult extends JqResult {
  readonly aborted: boolean;
}

// Node loads this file in a worker thread as it is, so it keeps to erasable TypeScript.
let jq = await loadJq();

// jq-wasm aborts its WebAssembly instance when jq exhausts the memory it may grow to; the worker
// then loads a fresh instance, since the aborted one is in an unknown state.
export default async function run(task: JqRun): Promise<JqRunResult> {
  try {
    const result = jq.raw(task.input, task.query, task.flags);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      aborted: false,
    };
  } catch {
    jq = await loadJq();
    return { stdout: '', stderr: '', exitCode: 1, aborted: true };
  }
}
