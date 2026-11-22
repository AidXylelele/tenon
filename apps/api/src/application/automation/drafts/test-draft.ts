import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { DraftRefusal } from "../../../domain/automation/drafts/enums.js";
import { TriggerKind } from "../../../domain/automation/instances/enums.js";
import { Workflow } from "../../../domain/automation/workflows/workflow.js";
import { Missing } from "../enums.js";
import {
  InstanceRuns,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "../instances/ports.js";
import { SecretRepository } from "../secrets/ports.js";
import { DefinitionRefusal } from "../workflows/enums.js";
import { DefinitionCompiler, WorkflowRepository } from "../workflows/ports.js";
import type { TestDraftCommand, TestDraftResult } from "./interfaces.js";
import { DraftRepository } from "./ports.js";

@Injectable()
export class TestDraft {
  constructor(
    private readonly drafts: DraftRepository,
    private readonly compiler: DefinitionCompiler,
    private readonly secrets: SecretRepository,
    private readonly workflows: WorkflowRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly runs: InstanceRuns,
    private readonly runtime: WorkflowRuntime,
  ) {}

  @Transactional()
  async execute(command: TestDraftCommand): Promise<TestDraftResult> {
    const draft = await this.drafts.findByName(command.name);

    if (draft === null) return { ok: false, failure: Missing.Draft };

    const current = draft.isAt(command.expected);

    if (!current)
      return {
        ok: false,
        failure: { refusal: DraftRefusal.Stale, current: draft.snapshot },
      };

    const owned = await this.secrets.findOwnedBy(command.starterId);
    const compiled = await this.compiler.compile(draft.source, owned);

    if (!compiled.ok) return compiled;

    const definition = compiled.value;
    const foreign = !draft.name.equals(definition.name);

    if (foreign) return { ok: false, failure: DefinitionRefusal.OtherWorkflow };

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
      originId: null,
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
