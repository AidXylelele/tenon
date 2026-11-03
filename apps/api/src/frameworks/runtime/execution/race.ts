import { Journal } from './journal.js';
import type { Scope } from './scope.js';

// Competing branches of a fork (DSL 1.0.3, "Fork": `compete`): the first to complete wins and
// the fork's step journals which, so that a replay keeps that winner; once it is decided, the
// other branches stop at their next task.
export class Race {
  #winner: Promise<number> | null = null;

  get decided(): boolean {
    return this.#winner !== null;
  }

  get winner(): Promise<number> | null {
    return this.#winner;
  }

  completed(scope: Scope, index: number): void {
    this.#winner ??= Race.#journaled(scope, index);
  }

  static async #journaled(scope: Scope, index: number): Promise<number> {
    const won = await Journal.value(scope, 'won', () => Promise.resolve(index));
    return won.ok ? won.value : index;
  }
}
