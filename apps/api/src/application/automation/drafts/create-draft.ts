import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { Draft } from "../../../domain/automation/drafts/draft.js";
import { DraftRefusal } from "../../../domain/automation/drafts/enums.js";
import { WorkflowRepository } from "../workflows/ports.js";
import { NameRefusal } from "./enums.js";
import type { CreateDraftCommand, CreateDraftResult } from "./interfaces.js";
import { DraftRepository } from "./ports.js";

@Injectable()
export class CreateDraft {
  constructor(
    private readonly drafts: DraftRepository,
    private readonly workflows: WorkflowRepository,
  ) {}

  @Transactional()
  async execute(command: CreateDraftCommand): Promise<CreateDraftResult> {
    const now = new Date();
    const current = await this.drafts.findByName(command.name);

    if (current !== null)
      return {
        ok: false,
        failure: { refusal: DraftRefusal.Exists, current: current.snapshot },
      };

    const workflow = await this.workflows.findByName(command.name);

    if (workflow !== null)
      return { ok: false, failure: NameRefusal.WorkflowExists };

    const draft = Draft.create({
      name: command.name,
      source: command.source,
      layout: command.layout,
      author: command.author,
      now,
    });
    await this.drafts.save(draft);
    return { ok: true, value: draft.snapshot };
  }
}
