import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { Workflow } from "../../../domain/automation/workflows/workflow.js";
import { WorkflowSchedules } from "../schedules/ports.js";
import { WorkflowRepository } from "../workflows/ports.js";
import { DraftCompilation } from "./draft-compilation.js";
import type { PublishDraftCommand, PublishDraftResult } from "./interfaces.js";

@Injectable()
export class PublishDraft {
  constructor(
    private readonly compilation: DraftCompilation,
    private readonly workflows: WorkflowRepository,
    private readonly schedules: WorkflowSchedules,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: PublishDraftCommand): Promise<PublishDraftResult> {
    const compiled = await this.compilation.compile(
      command.name,
      command.expected,
      command.publisherId,
    );

    if (!compiled.ok) return compiled;

    const draft = compiled.value.draft;
    const definition = compiled.value.definition;
    const refusedSchedule = await this.schedules.check(definition);

    if (refusedSchedule !== null)
      return { ok: false, failure: [refusedSchedule] };

    const now = new Date();
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
