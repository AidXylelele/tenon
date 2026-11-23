import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { Missing } from "../enums.js";
import type { ArchiveResult, ArchiveWorkflowCommand } from "./interfaces.js";
import { WorkflowRepository } from "./ports.js";

@Injectable()
export class ArchiveWorkflow {
  constructor(private readonly workflows: WorkflowRepository) {}

  @Transactional()
  async execute(command: ArchiveWorkflowCommand): Promise<ArchiveResult> {
    const now = new Date();
    const workflow = await this.workflows.findByName(command.name);

    if (workflow === null) return { ok: false, failure: Missing.Workflow };

    const archived = workflow.archive(now);

    if (!archived.ok) return archived;

    if (archived.value) await this.workflows.save(workflow);

    return { ok: true, value: undefined };
  }
}
