import type { Expression } from '../expression.js';
import { DefinitionProgress } from '../progress/definition-progress.js';
import type { KindProgress } from '../progress/kind-progress.js';
import type { RoundResults } from '../round-results.js';
import type { BodyScope } from '../scopes/body-scope.js';
import type { Step } from '../step.js';
import type { Template } from '../template.js';
import { Task } from './task.js';

// A task whose body is its own definition: its templates evaluate on the transformed input
// (stage 2), and the task decides what the evaluated definition starts.
export abstract class LeafTask extends Task {
  abstract get templates(): readonly (Expression | Template)[];

  // An outcome, a call, a process, a declared function or a sub-workflow.
  abstract defined(results: RoundResults, scope: BodyScope): Step<KindProgress>;

  enter(scope: BodyScope<LeafTask>): Step<KindProgress> {
    return DefinitionProgress.enter(scope);
  }

  protected override get ownExpressions(): readonly Expression[] {
    const found: Expression[] = [];

    for (const template of this.templates)
      for (const expression of template.expressions) found.push(expression);

    return found;
  }
}
