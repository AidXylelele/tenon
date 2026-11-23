import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { DraftRefusal } from "../../../domain/automation/drafts/enums.js";
import { Workflow } from "../../../domain/automation/workflows/workflow.js";
import { Missing } from "../enums.js";
import { WorkflowSchedules } from "../schedules/ports.js";
import { SecretRepository } from "../secrets/ports.js";
import { DefinitionRefusal } from "../workflows/enums.js";
import { DefinitionCompiler, WorkflowRepository } from "../workflows/ports.js";
import type { PublishDraftCommand, PublishDraftResult } from "./interfaces.js";
import { DraftRepository } from "./ports.js";

@Injectable()
export class PublishDraft {
  constructor(
    private readonly drafts: DraftRepository,
    private readonly compiler: DefinitionCompiler,
    private readonly workflows: WorkflowRepository,
    private readonly secrets: SecretRepository,
    private readonly schedules: WorkflowSchedules,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: PublishDraftCommand): Promise<PublishDraftResult> {
    const draft = await this.drafts.findByName(command.name);

    if (draft === null) return { ok: false, failure: Missing.Draft };

    const current = draft.isAt(command.expected);

    if (!current)
      return {
        ok: false,
        failure: { refusal: DraftRefusal.Stale, current: draft.snapshot },
      };

    const now = new Date();
    const owned = await this.secrets.findOwnedBy(command.publisherId);
    const compiled = await this.compiler.compile(draft.source, owned);

    if (!compiled.ok) return compiled;

    const definition = compiled.value;
    const foreign = !draft.name.equals(definition.name);

    if (foreign) return { ok: false, failure: DefinitionRefusal.OtherWorkflow };

    const refusedSchedule = await this.schedules.check(definition);

    if (refusedSchedule !== null)
      return { ok: false, failure: [refusedSchedule] };

    const found = await this.workflows.findByName(definition.name);
    const workflow = found ?? Workflow.register(definition.name);
    const published = workflow.publish({
      definition,
      source: draft.source,
      publisherId: command.publisherId,
      now,
    });

    if (!published.ok) return published;

    const publication = published.value;

    if (publication.created)
      await this.unitOfWork.run(() => this.workflows.save(workflow));

    const version = {
      namespace: workflow.name.namespace,
      name: workflow.name.name,
      version: publication.version.semver,
      created: publication.created,
    };
    return { ok: true, value: version };
  }
}
