import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { TriggerKind } from "../../../domain/automation/instances/enums.js";
import { Missing } from "../enums.js";
import { WorkflowRepository } from "../workflows/ports.js";
import {
  InstanceRuns,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "./ports.js";
import type {
  StartInstanceCommand,
  StartInstanceResult,
} from "./interfaces.js";

@Injectable()
export class StartInstance {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly runs: InstanceRuns,
    private readonly runtime: WorkflowRuntime,
  ) {}

  @Transactional()
  async execute(command: StartInstanceCommand): Promise<StartInstanceResult> {
    const workflow = await this.workflows.findByName(command.name);

    if (workflow === null) return { ok: false, failure: Missing.Workflow };

    const version = workflow.versionToRun(command.version);

    if (version === null) return { ok: false, failure: Missing.Version };

    const problems = await this.runtime.inputProblemsOf(version, command.input);

    if (problems.length > 0) return { ok: false, failure: problems };

    const now = new Date();
    const started = workflow.startInstance({
      instanceId: null,
      version,
      input: command.input,
      trigger: TriggerKind.Manual,
      starterId: command.starterId,
      origin: null,
      originEffectId: null,
      now,
    });

    if (!started.ok) return started;

    const instance = started.value;
    await this.instances.save(instance);
    await this.runs.start(instance);
    return { ok: true, value: { instanceId: instance.id } };
  }
}
