import {
  Workflow,
  type WorkflowContext,
  type WorkflowRunner,
  type WorkflowStepContext,
} from "@nestjs/workflows";
import { EffectClient } from "../interfaces.js";
import type { ProcessRunInput } from "./interfaces.js";

@Workflow("process", { version: 2 })
export class ProcessRun implements WorkflowRunner<ProcessRunInput, void> {
  private static readonly STEP = "run";

  constructor(private readonly performer: EffectClient) {}

  async run(ctx: WorkflowContext, input: ProcessRunInput): Promise<void> {
    await ctx.step(ProcessRun.STEP, (attempt) =>
      this.#performed(input, attempt),
    );
  }

  async #performed(
    input: ProcessRunInput,
    attempt: WorkflowStepContext,
  ): Promise<null> {
    const step = {
      idempotencyKey: attempt.idempotencyKey,
      signal: attempt.signal,
      secrets: input.secrets,
    };
    await this.performer.performDetached(input.request, step);
    return null;
  }
}
