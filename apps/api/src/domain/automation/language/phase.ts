import { InconsistentProgressError } from '../../errors.js';

export class Phase {
  static readonly Pending = new Phase('pending', false);
  static readonly Running = new Phase('running', false);
  static readonly Waiting = new Phase('waiting', false);
  static readonly Suspended = new Phase('suspended', false);
  static readonly Cancelled = new Phase('cancelled', true);
  static readonly Faulted = new Phase('faulted', true);
  static readonly Completed = new Phase('completed', true);

  static readonly #all: readonly Phase[] = [
    Phase.Pending,
    Phase.Running,
    Phase.Waiting,
    Phase.Suspended,
    Phase.Cancelled,
    Phase.Faulted,
    Phase.Completed,
  ];

  readonly #name: string;
  readonly #terminal: boolean;

  private constructor(name: string, terminal: boolean) {
    this.#name = name;
    this.#terminal = terminal;
  }

  static named(name: string): Phase {
    const phase = Phase.#all.find((candidate) => candidate.#name === name);

    if (phase === undefined)
      throw new InconsistentProgressError('a phase of the standard');

    return phase;
  }

  get name(): string {
    return this.#name;
  }

  isTerminal(): boolean {
    return this.#terminal;
  }
}
