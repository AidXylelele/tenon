import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { WorkflowRepository } from "../workflows/ports.js";
import { EffectResult } from "./enums.js";
import type { EffectCommand } from "./interfaces.js";
import {
  InstanceEvents,
  InstanceRuns,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "./ports.js";

@Injectable()
export class StartChildForEffect {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly runtime: WorkflowRuntime,
    private readonly events: InstanceEvents,
    private readonly runs: InstanceRuns,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: EffectCommand): Promise<void> {
    const parent = await this.instances.find(command.instanceId);
    const request = parent?.requestOf(command.effectId) ?? null;

    if (parent === null || request === null) return;

    const existing = await this.instances.findChild(
      parent.id,
      command.effectId,
    );

    if (existing !== null) return;

    const requested = this.runtime.childOf(request);
    const workflow = await this.workflows.findByName(requested.name);
    const version = workflow?.versionToRun(requested.version) ?? null;
    const missingOutcome = this.runtime.outcomeOf(EffectResult.Missing);
    const missing = { effectId: command.effectId, outcome: missingOutcome };

    if (workflow === null || version === null) {
      await this.unitOfWork.run(() => this.runs.respond(parent, missing));
      return;
    }

    const now = new Date();
    const started = workflow.startInstance({
      instanceId: null,
      version,
      input: requested.input,
      trigger: requested.trigger,
      starterId: null,
      origin: parent,
      originEffectId: command.effectId,
      now,
    });

    if (!started.ok) {
      await this.unitOfWork.run(() => this.runs.respond(parent, missing));
      return;
    }

    const child = started.value;
    const startedOutcome = this.runtime.outcomeOf(EffectResult.Started);
    const answer = { effectId: command.effectId, outcome: startedOutcome };
    await this.unitOfWork.run(async () => {
      await this.instances.save(child);
      await this.events.dispatch(child);

      if (child.awaitedBy !== null) return;

      await this.runs.respond(parent, answer);
    });
  }
}
