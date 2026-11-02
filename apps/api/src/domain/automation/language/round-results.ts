import type { JsonValue, RoundResultsProps } from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';
import type { EvaluationResult } from './results/evaluation-result.js';
import type { ProcessResult } from './results/process-result.js';
import type { ServiceResult } from './results/service-result.js';
import type { ValidationResult } from './results/validation-result.js';
import type { RoundWork } from './round-work.js';
import type { WorkflowError } from './workflow-error.js';

export class RoundResults {
  readonly #evaluated: ReadonlyMap<string, EvaluationResult>;
  readonly #validated: ReadonlyMap<string, ValidationResult>;
  readonly #responses: ReadonlyMap<string, ServiceResult>;
  readonly #processes: ReadonlyMap<string, ProcessResult>;

  constructor(props: RoundResultsProps) {
    this.#evaluated = RoundResults.#byId(props.evaluated);
    this.#validated = RoundResults.#byId(props.validated);
    this.#responses = RoundResults.#byId(props.responses);
    this.#processes = RoundResults.#byId(props.processes);
  }

  static none(): RoundResults {
    return new RoundResults({
      evaluated: [],
      validated: [],
      responses: [],
      processes: [],
    });
  }

  static #byId<R extends { readonly id: string }>(
    results: readonly R[],
  ): ReadonlyMap<string, R> {
    const indexed = new Map<string, R>();

    for (const result of results) indexed.set(result.id, result);

    return indexed;
  }

  answers(work: RoundWork): boolean {
    const evaluated = work.evaluations.every((item) =>
      this.#evaluated.has(item.id),
    );
    const validated = work.validations.every((item) =>
      this.#validated.has(item.id),
    );
    const responded = work.calls.every((item) => this.#responses.has(item.id));
    const exited = work.processes.every((item) => this.#processes.has(item.id));
    return evaluated && validated && responded && exited;
  }

  deferredIn(work: RoundWork): number {
    const calls = work.calls.filter((call) => !this.#responses.has(call.id));
    const runs = work.processes.filter((run) => !this.#processes.has(run.id));
    return calls.length + runs.length;
  }

  failureOf(id: string, at: JsonPointer): WorkflowError | null {
    const evaluation = this.#evaluated.get(id);

    if (evaluation !== undefined) return evaluation.failure(at);

    const validation = this.#validated.get(id);

    if (validation !== undefined) return validation.failure(at);

    return null;
  }

  valueOf(id: string): JsonValue {
    const evaluation = this.#evaluated.get(id);
    return evaluation?.value ?? null;
  }

  response(id: string): ServiceResult | null {
    return this.#responses.get(id) ?? null;
  }

  process(id: string): ProcessResult | null {
    return this.#processes.get(id) ?? null;
  }
}
