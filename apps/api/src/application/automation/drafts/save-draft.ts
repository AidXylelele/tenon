import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { DraftRefusal } from "../../../domain/automation/drafts/enums.js";
import type { DraftResult, SaveDraftCommand } from "./interfaces.js";
import { DraftRepository } from "./ports.js";

@Injectable()
export class SaveDraft {
  constructor(
    private readonly drafts: DraftRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: SaveDraftCommand): Promise<DraftResult> {
    const now = new Date();
    const draft = await this.drafts.findByName(command.name);

    if (draft === null)
      return {
        ok: false,
        failure: { refusal: DraftRefusal.Stale, current: null },
      };

    const saved = draft.save({
      expected: command.expected,
      source: command.source,
      layout: command.layout,
      author: command.author,
      now,
    });

    if (!saved.ok)
      return {
        ok: false,
        failure: { refusal: saved.failure, current: draft.snapshot },
      };

    if (saved.value) await this.unitOfWork.run(() => this.drafts.save(draft));

    return { ok: true, value: draft.snapshot };
  }
}
