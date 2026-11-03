import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import type { StepOptions } from '../interfaces.js';
import { TaskFault } from './faults.js';
import type { Scope } from './scope.js';

// A failure also says when an enclosing `try` runs its tasks again for it, or null.
export type Journaled<T extends JsonValue> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly error: JsonObject;
      readonly retryAt: number | null;
    };

// A composite's own work as an engine step. A DSL fault comes back as a value: a thrown error
// would fail the engine's run rather than the task. The retry of the fault is decided in the
// same step, where the fault arose.
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

        const retryAt = await scope.retryAtOf(error.error);
        return { ok: false, error: error.error, retryAt };
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
