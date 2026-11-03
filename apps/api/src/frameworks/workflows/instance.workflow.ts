import {
  isWorkflowInterrupt,
  Workflow,
  type WorkflowContext,
  type WorkflowRunner,
} from '@nestjs/workflows';
import { RunDirective } from '../../domain/automation/instances/enums.js';
import { RunOutcomeKind } from '../../interface-adapters/workflows/enums.js';
import { InstanceRunController } from '../../interface-adapters/workflows/runs/instance-run.controller.js';
import type { RunOutcome } from '../../interface-adapters/workflows/interfaces.js';
import { ErrorKind, TaskFault } from '../runtime/execution/faults.js';
import { JsonPointer } from '../runtime/document/json-pointer.js';
import { Runtime } from '../runtime/runtime.js';
import { EngineDurability } from './engine-durability.js';
import { StepErrors } from './step-errors.js';

export interface InstanceRunInput {
  readonly instanceId: string;
}

// The run of one instance: the platform records its start, the runtime runs the document, the
// platform records its end. A defect of the platform faults the instance instead of leaving it
// running.
@Workflow('instance', { version: 2 })
export class InstanceWorkflow implements WorkflowRunner<
  InstanceRunInput,
  void
> {
  constructor(
    private readonly runtime: Runtime,
    private readonly controller: InstanceRunController,
    private readonly errors: StepErrors,
  ) {}

  async run(ctx: WorkflowContext, input: InstanceRunInput): Promise<void> {
    const id = input.instanceId;
    const durability = new EngineDurability(ctx, this.errors, id);
    const once = { timeoutMs: null, retry: null };
    const directive = await durability.step(
      'begin',
      () => this.controller.begin(id),
      once,
    );

    if (directive === RunDirective.Stop) return;

    const plan = await durability.step(
      'plan',
      () => this.controller.plan(id),
      once,
    );

    if (plan === null) return;

    const outcome = await this.#outcomeOf(durability, plan, id);

    if (outcome.kind === RunOutcomeKind.Completed) {
      const output = outcome.output;
      await durability.step(
        'end',
        () => this.controller.completed(id, output),
        once,
      );
      return;
    }

    if (outcome.kind === RunOutcomeKind.Faulted) {
      const error = outcome.error;
      await durability.step(
        'end',
        () => this.controller.faulted(id, error),
        once,
      );
    }
  }

  async #outcomeOf(
    durability: EngineDurability,
    plan: NonNullable<Awaited<ReturnType<InstanceRunController['plan']>>>,
    id: string,
  ): Promise<RunOutcome> {
    try {
      return await this.runtime.run(plan, durability, this.controller);
    } catch (error) {
      if (isWorkflowInterrupt(error)) throw error;

      const fault = TaskFault.of(
        ErrorKind.Runtime,
        JsonPointer.ROOT,
        `The run of instance ${id} failed`,
      );
      return { kind: RunOutcomeKind.Faulted, error: fault.error };
    }
  }
}
