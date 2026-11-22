import {
  Workflow,
  type WorkflowContext,
  type WorkflowRunner,
} from "@nestjs/workflows";
import { EffectClient } from "../interfaces.js";
import type { ProcessRunInput } from "./interfaces.js";

@Workflow("process", { version: 2 })
export class ProcessRun implements WorkflowRunner<ProcessRunInput, void> {
  constructor(private readonly performer: EffectClient) {}

  async run(ctx: WorkflowContext, input: ProcessRunInput): Promise<void> {
    await ctx.step("run", async (attempt) => {
      const step = {
        idempotencyKey: attempt.idempotencyKey,
        signal: attempt.signal,
        secrets: input.secrets,
      };
      await this.performer.performDetached(input.request, step);
      return null;
    });
  }
}
