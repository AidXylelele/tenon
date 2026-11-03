import {
  Workflow,
  type WorkflowContext,
  type WorkflowRunner,
} from '@nestjs/workflows';
import { SandboxOutcomeKind } from '../runtime/enums.js';
import { CapacityExhaustedError } from '../runtime/execution/faults.js';
import { type GoJudgeCommand, SandboxClient } from '../runtime/interfaces.js';
import { StepErrors } from './step-errors.js';

export interface ProcessRunInput {
  readonly command: GoJudgeCommand;
}

// A process a task detached (`run` with `await: false`): it runs once in the sandbox, repeated
// only through an outage of the sandbox; nobody reads its outcome.
@Workflow('process', { version: 1 })
export class ProcessWorkflow implements WorkflowRunner<ProcessRunInput, void> {
  constructor(
    private readonly sandbox: SandboxClient,
    private readonly errors: StepErrors,
  ) {}

  async run(ctx: WorkflowContext, input: ProcessRunInput): Promise<void> {
    await ctx.step('run', () =>
      this.errors.classified(async () => {
        const outcome = await this.sandbox.run(input.command);
        const outage =
          outcome.kind === SandboxOutcomeKind.Rejected ||
          outcome.kind === SandboxOutcomeKind.Unreachable ||
          outcome.kind === SandboxOutcomeKind.Unrecognized ||
          outcome.kind === SandboxOutcomeKind.TimedOut;

        if (outage) throw new CapacityExhaustedError();

        return null;
      }),
    );
  }
}
