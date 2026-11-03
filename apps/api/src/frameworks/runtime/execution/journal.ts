import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import type { StepOptions } from '../interfaces.js';
import { TaskFault } from './faults.js';
import type { Scope } from './scope.js';

export type Journaled<T extends JsonValue> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: JsonObject };

// A composite's own work as an engine step. A DSL fault comes back as a value: a thrown error
// would fail the engine's run rather than the task.
export class Journal {
  static readonly #ONCE: StepOptions = { timeoutMs: null, retry: null };

  static async value<T extends JsonValue>(
    scope: Scope,
    suffix: string,
    work: () => Promise<T>,
  ): Promise<Journaled<T>> {
    const name = scope.named(suffix);
    const guarded = async (): Promise<JsonObject> => {
      try {
        const value = await work();
        return { ok: true, value };
      } catch (error) {
        if (!(error instanceof TaskFault)) throw error;

        return { ok: false, error: error.error };
      }
    };
    const result = await scope.run.durability.step(
      name,
      guarded,
      Journal.#ONCE,
    );
    return result as Journaled<T>;
  }
}
