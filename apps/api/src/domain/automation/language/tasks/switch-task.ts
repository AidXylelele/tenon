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
import type { BodyScope } from '../scopes/body-scope.js';
import { Task } from './task.js';
import type { SwitchCase } from '../switch-case.js';
import type { WorkKey } from '../work-key.js';

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

  enter(scope: BodyScope<SwitchTask>): Step<KindProgress> {
    return SwitchProgress.enter(scope);
  }

  evaluationsFor(
    key: WorkKey,
    data: JsonValue,
    args: JsonObject,
  ): readonly Evaluation[] {
    const evaluations: Evaluation[] = [];

    for (const switchCase of this.#cases) {
      const found = switchCase.when?.evaluationsFor(key, data, args) ?? [];

      for (const evaluation of found) evaluations.push(evaluation);
    }

    return evaluations;
  }

  outcomeFor(input: JsonValue, key: WorkKey, results: RoundResults): Outcome {
    for (const switchCase of this.#cases) {
      const when = switchCase.when;

      if (when === null) continue;

      const failure = when.failureIn(key, results, this.reference);

      if (failure !== null) return Outcome.failed(failure);

      const matched = when.holds(key, results);

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
