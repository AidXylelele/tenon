import type { JsonValue } from './interfaces.js';
import type { ProcessExited } from './results/process-exited.js';

export class ProcessReturn {
  static readonly Stdout = new ProcessReturn('stdout', (exit) => exit.stdout);
  static readonly Stderr = new ProcessReturn('stderr', (exit) => exit.stderr);
  static readonly Code = new ProcessReturn('code', (exit) => exit.code);
  static readonly All = new ProcessReturn('all', (exit) => ({
    code: exit.code,
    stdout: exit.stdout,
    stderr: exit.stderr,
  }));
  static readonly None = new ProcessReturn('none', () => null);

  static readonly #values: readonly ProcessReturn[] = [
    ProcessReturn.Stdout,
    ProcessReturn.Stderr,
    ProcessReturn.Code,
    ProcessReturn.All,
    ProcessReturn.None,
  ];

  readonly #name: string;
  readonly #select: (exit: ProcessExited) => JsonValue;

  private constructor(
    name: string,
    select: (exit: ProcessExited) => JsonValue,
  ) {
    this.#name = name;
    this.#select = select;
  }

  static named(name: string): ProcessReturn | null {
    const found = ProcessReturn.#values.find((value) => value.#name === name);
    return found ?? null;
  }

  outputOf(exit: ProcessExited): JsonValue {
    return this.#select(exit);
  }
}
