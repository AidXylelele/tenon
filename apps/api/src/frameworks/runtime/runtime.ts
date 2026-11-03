import { RunOutcomeKind } from '../../interface-adapters/workflows/enums.js';
import type {
  RunObserver,
  RunOutcome,
  RunPlan,
} from '../../interface-adapters/workflows/interfaces.js';
import { JsonPointer } from './document/json-pointer.js';
import type { DataFlow } from './execution/data-flow.js';
import { EndingKind } from './execution/endings.js';
import { Journal } from './execution/journal.js';
import { RunContext, Scope } from './execution/scope.js';
import type { TaskRunner } from './execution/task-runner.js';
import type { Durability, RuntimeDescriptor } from './interfaces.js';
import type { JsonObject } from '../../domain/automation/json.js';

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
    const context = new RunContext(plan, durability, observer, this.descriptor);
    const unbounded = Scope.root(context, null);
    const workflow = context.workflow;
    // Read on every execution and never journaled: a replaced value counts from the next one.
    const names = workflow.use?.secrets ?? [];
    const secrets = await observer.secrets(plan.instanceId, names);
    context.keepSecrets(secrets);
    const started = await Journal.value(unbounded, 'input', async () => {
      const args = context.argumentsFor(plan.input);
      const input = await this.flow.input(
        workflow.input,
        plan.input,
        args,
        JsonPointer.ROOT,
      );
      const deadline = await this.#deadlineOf(plan, args, unbounded);
      return { input, deadline };
    });

    if (!started.ok) {
      const error = context.masked(started.error);
      return { kind: RunOutcomeKind.Faulted, error };
    }

    const scope = Scope.root(context, started.value.deadline);
    const ending = await this.runner.list(
      workflow.do,
      started.value.input,
      scope.child('do'),
    );

    if (ending.kind === EndingKind.Stopped)
      return { kind: RunOutcomeKind.Stopped };

    if (ending.kind === EndingKind.Faulted) {
      const error = context.masked(ending.error);
      return { kind: RunOutcomeKind.Faulted, error };
    }

    const ended = await Journal.value(scope, 'output', () => {
      const args = context.argumentsFor(ending.output);
      return this.flow.output(
        workflow.output,
        ending.output,
        args,
        JsonPointer.ROOT,
      );
    });

    if (!ended.ok) {
      const error = context.masked(ended.error);
      return { kind: RunOutcomeKind.Faulted, error };
    }

    const output = context.masked(ended.value);
    return { kind: RunOutcomeKind.Completed, output };
  }

  // The workflow's timeout counts from its start (FR-014); one written as an expression is
  // evaluated on the raw input as the run starts.
  async #deadlineOf(
    plan: RunPlan,
    args: JsonObject,
    scope: Scope,
  ): Promise<number | null> {
    const declared = scope.run.workflow.timeout;
    const limit = await this.runner.timeoutOf(
      declared,
      plan.input,
      args,
      scope,
    );

    if (limit === null) return null;

    const start = Date.parse(plan.startedAt);
    return start + limit;
  }
}
