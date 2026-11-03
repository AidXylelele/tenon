import type { Specification } from '@openworkflowspec/sdk';
import { RunOutcomeKind } from '../../interface-adapters/workflows/enums.js';
import type {
  RunObserver,
  RunOutcome,
  RunPlan,
} from '../../interface-adapters/workflows/interfaces.js';
import { Durations } from './document/durations.js';
import { JsonPointer } from './document/json-pointer.js';
import type { DataFlow } from './execution/data-flow.js';
import { EndingKind } from './execution/endings.js';
import { Journal } from './execution/journal.js';
import { RunContext, Scope } from './execution/scope.js';
import type { TaskRunner } from './execution/task-runner.js';
import type { Durability, RuntimeDescriptor } from './interfaces.js';

// Runs one instance of a workflow document with the standard's semantics, on any durable engine
// the `Durability` gives: the workflow's input transformed, its tasks, its output transformed.
export class Runtime {
  constructor(
    private readonly runner: TaskRunner,
    private readonly flow: DataFlow,
    private readonly descriptor: RuntimeDescriptor,
  ) {}

  async run(
    plan: RunPlan,
    durability: Durability,
    observer: RunObserver,
  ): Promise<RunOutcome> {
    const deadline = Runtime.#deadlineOf(plan);
    const context = new RunContext(
      plan,
      durability,
      observer,
      this.descriptor,
      deadline,
    );
    const scope = Scope.root(context);
    const workflow = context.workflow;
    const started = await Journal.value(scope, 'input', () => {
      const args = context.argumentsFor(plan.input);
      return this.flow.input(
        workflow.input,
        plan.input,
        args,
        JsonPointer.ROOT,
      );
    });

    if (!started.ok)
      return { kind: RunOutcomeKind.Faulted, error: started.error };

    const ending = await this.runner.list(
      workflow.do,
      started.value,
      scope.child('do'),
    );

    if (ending.kind === EndingKind.Stopped)
      return { kind: RunOutcomeKind.Stopped };

    if (ending.kind === EndingKind.Faulted)
      return { kind: RunOutcomeKind.Faulted, error: ending.error };

    const ended = await Journal.value(scope, 'output', () => {
      const args = context.argumentsFor(ending.output);
      return this.flow.output(
        workflow.output,
        ending.output,
        args,
        JsonPointer.ROOT,
      );
    });

    if (!ended.ok) return { kind: RunOutcomeKind.Faulted, error: ended.error };

    return { kind: RunOutcomeKind.Completed, output: ended.value };
  }

  // The workflow's timeout counts from its start (FR-014); one written as an expression is not
  // known before the run and bounds nothing.
  static #deadlineOf(plan: RunPlan): number | null {
    const workflow = plan.document as unknown as Specification.Workflow;
    const declared = workflow.timeout;

    if (declared === undefined) return null;

    const timeouts = (workflow.use?.timeouts ?? {}) as Record<
      string,
      Specification.Timeout
    >;
    const timeout =
      typeof declared === 'string' ? timeouts[declared] : declared;
    const after = timeout?.after;

    if (after === undefined || Durations.isExpression(after)) return null;

    const start = Date.parse(plan.startedAt);
    return start + Durations.millisecondsOf(after);
  }
}
