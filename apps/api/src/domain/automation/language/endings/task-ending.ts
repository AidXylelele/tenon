import type { FlowDirective } from '../flow-directive.js';
import type { JsonValue } from '../interfaces.js';
import { Outcome } from '../outcome.js';
import type { Phase } from '../phase.js';
import type { WorkflowError } from '../workflow-error.js';

// How a task ended: completed, faulted or skipped.
export abstract class TaskEnding {
  abstract get output(): JsonValue;

  // Where the flow goes on; a faulted task names none.
  abstract get directive(): FlowDirective | null;

  abstract get failure(): WorkflowError | null;

  // The effects of the body, acted on once: an emitted event, a detached process or workflow.
  abstract get body(): Outcome | null;

  isSkipped(): boolean {
    return false;
  }

  // The workflow's context after the task: only a completed export replaces it.
  contextOr(current: JsonValue): JsonValue {
    return current;
  }

  // An ending that ends the workflow (`then: end`, `then: exit` at the root) as an outcome.
  workflowEnd(): Outcome | null {
    const directive = this.directive;

    if (!directive?.endsWorkflow()) return null;

    return Outcome.directed(this.output, directive);
  }

  abstract phase(): Phase | null;

  abstract outcome(): Outcome;
}
