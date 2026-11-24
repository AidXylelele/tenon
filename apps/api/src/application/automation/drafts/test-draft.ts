import { Injectable } from "@nestjs/common";
import { TriggerKind } from "../../../domain/automation/instances/enums.js";
import { Workflow } from "../../../domain/automation/workflows/workflow.js";
import { UnitOfWork } from "../../unit-of-work.js";
import { InstanceEvents } from "../instances/instance-events.js";
import {
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "../instances/ports.js";
import { WorkflowEvents, WorkflowRepository } from "../workflows/ports.js";
import { DraftCompilation } from "./draft-compilation.js";
import type { TestDraftCommand, TestDraftResult } from "./interfaces.js";

@Injectable()
export class TestDraft {
  constructor(
    private readonly compilation: DraftCompilation,
    private readonly workflows: WorkflowRepository,
    private readonly workflowEvents: WorkflowEvents,
    private readonly instances: WorkflowInstanceRepository,
    private readonly instanceEvents: InstanceEvents,
    private readonly runtime: WorkflowRuntime,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: TestDraftCommand): Promise<TestDraftResult> {
    const compiled = await this.compilation.compile(
      command.name,
      command.expected,
      command.starterId,
    );

    if (!compiled.ok) return compiled;

    const draft = compiled.value.draft;
    const definition = compiled.value.definition;
    const now = new Date();
    const found = await this.workflows.findByName(definition.name);
    const workflow = found ?? Workflow.register(definition.name);
    const tested = workflow.testDraft({
      definition,
      source: draft.source,
      publisherId: command.starterId,
      now,
    });

    if (!tested.ok) return tested;

    const version = tested.value.version;

    if (tested.value.created)
      await this.unitOfWork.run(async () => {
        await this.workflows.save(workflow);
        await this.workflowEvents.dispatch(workflow);
      });

    const inputProblems = await this.runtime.inputProblemsOf(
      version,
      command.input,
    );

    if (inputProblems.length > 0)
      return { ok: false, failure: { inputProblems } };

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
    await this.unitOfWork.run(async () => {
      await this.instances.save(instance);
      await this.instanceEvents.dispatch(instance);
    });
    return { ok: true, value: { instanceId: instance.id } };
  }
}
