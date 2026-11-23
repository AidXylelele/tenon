import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import type { TimerCommand } from "./interfaces.js";
import {
  InstanceRuns,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "./ports.js";

@Injectable()
export class AnswerTimer {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly runtime: WorkflowRuntime,
    private readonly runs: InstanceRuns,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: TimerCommand): Promise<void> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return;

    const now = Math.max(Date.now(), command.at);
    const end = instance.waitEndAt(command.effectId, now);

    if (end === null) return;

    const outcome = this.runtime.outcomeOf(end);
    const answer = { effectId: command.effectId, outcome };
    await this.unitOfWork.run(() => this.runs.respond(instance, answer));
  }
}
