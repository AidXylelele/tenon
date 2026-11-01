import { DuplicateDefaultCaseError } from '../../../errors.js';
import type { Expression } from '../expression.js';
import type { FlowDirective } from '../flow-directive.js';
import type {
  Evaluation,
  JsonObject,
  JsonValue,
  SwitchTaskProps,
} from '../interfaces.js';
import { Outcome } from '../outcome.js';
import type { KindProgress } from '../progress/kind-progress.js';
import { SwitchProgress } from '../progress/switch-progress.js';
import type { Step } from '../step.js';
import type { RoundResults } from '../round-results.js';
import type { TaskScope } from '../scopes/task-scope.js';
import { Task } from './task.js';
import type { SwitchCase } from '../switch-case.js';

export class SwitchTask extends Task {
  readonly #cases: readonly SwitchCase[];

  constructor(props: SwitchTaskProps) {
    super(props);
    const defaults = props.cases.filter((item) => item.isDefault());
    const second = defaults[1];

    if (second !== undefined)
      throw new DuplicateDefaultCaseError(second.reference);

    this.#cases = props.cases;
  }

  get cases(): readonly SwitchCase[] {
    return this.#cases;
  }

  override get directives(): readonly FlowDirective[] {
    const cases = this.#cases.map((switchCase) => switchCase.then);
    const own = super.directives;
    return cases.concat(own);
  }

  enter(input: JsonValue, scope: TaskScope<SwitchTask>): Step<KindProgress> {
    return SwitchProgress.enter(input, scope);
  }

  evaluationsFor(
    prefix: string,
    data: JsonValue,
    args: JsonObject,
  ): readonly Evaluation[] {
    const evaluations: Evaluation[] = [];

    for (const switchCase of this.#cases) {
      const found = switchCase.when?.evaluationsFor(prefix, data, args) ?? [];

      for (const evaluation of found) evaluations.push(evaluation);
    }

    return evaluations;
  }

  outcomeFor(input: JsonValue, prefix: string, results: RoundResults): Outcome {
    for (const switchCase of this.#cases) {
      const when = switchCase.when;

      if (when === null) continue;

      const failure = when.failureIn(prefix, results, this.reference);

      if (failure !== null) return Outcome.failed(failure);

      const matched = when.holds(prefix, results);

      if (matched) return Outcome.directed(input, switchCase.then);
    }

    const fallback = this.#cases.find((item) => item.isDefault());

    if (fallback === undefined) return Outcome.of(input);

    return Outcome.directed(input, fallback.then);
  }

  protected override get ownExpressions(): readonly Expression[] {
    const found: Expression[] = [];

    for (const switchCase of this.#cases)
      for (const expression of switchCase.when?.expressions ?? [])
        found.push(expression);

    return found;
  }
}
