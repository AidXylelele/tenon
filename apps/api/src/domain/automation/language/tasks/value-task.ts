import type { Expression } from '../expression.js';
import type { JsonValue } from '../interfaces.js';
import type { Outcome } from '../outcome.js';
import { ConcludedProgress } from '../progress/concluded-progress.js';
import type { KindProgress } from '../progress/kind-progress.js';
import type { RoundResults } from '../round-results.js';
import type { BodyScope } from '../scopes/body-scope.js';
import type { Step } from '../step.js';
import type { Template } from '../template.js';
import { LeafTask } from './leaf-task.js';

// `set`, `raise` and `emit`: one template whose value decides the outcome.
export abstract class ValueTask extends LeafTask {
  abstract get template(): Expression | Template;

  get templates(): readonly (Expression | Template)[] {
    return [this.template];
  }

  defined(results: RoundResults, scope: BodyScope): Step<KindProgress> {
    const value = scope.filled(this.template, results);
    const outcome = this.outcomeOf(value, scope);
    return ConcludedProgress.step(outcome);
  }

  protected abstract outcomeOf(value: JsonValue, scope: BodyScope): Outcome;
}
