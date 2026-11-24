import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { Missing } from "../enums.js";
import type { DiscardDraftCommand, DiscardDraftResult } from "./interfaces.js";
import { DraftRepository } from "./ports.js";

@Injectable()
export class DiscardDraft {
  constructor(
    private readonly drafts: DraftRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: DiscardDraftCommand): Promise<DiscardDraftResult> {
    const draft = await this.drafts.findByName(command.name);

    if (draft === null) return { ok: false, failure: Missing.Draft };

    const discarded = draft.discard(command.expected);

    if (!discarded.ok)
      return {
        ok: false,
        failure: { refusal: discarded.failure, current: draft.snapshot },
      };

    await this.unitOfWork.run(() => this.drafts.remove(draft));
    return { ok: true, value: undefined };
  }
}
