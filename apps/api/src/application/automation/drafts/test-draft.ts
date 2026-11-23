import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { TriggerKind } from "../../../domain/automation/instances/enums.js";
import { Workflow } from "../../../domain/automation/workflows/workflow.js";
import {
  InstanceRuns,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "../instances/ports.js";
import { WorkflowRepository } from "../workflows/ports.js";
import { DraftCompilation } from "./draft-compilation.js";
import type { TestDraftCommand, TestDraftResult } from "./interfaces.js";

@Injectable()
export class TestDraft {
  constructor(
    private readonly compilation: DraftCompilation,
    private readonly workflows: WorkflowRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly runs: InstanceRuns,
    private readonly runtime: WorkflowRuntime,
  ) {}

  @Transactional()
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

    if (tested.value.created) await this.workflows.save(workflow);

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
    await this.instances.save(instance);
    await this.runs.start(instance);
    return { ok: true, value: { instanceId: instance.id } };
  }
}
