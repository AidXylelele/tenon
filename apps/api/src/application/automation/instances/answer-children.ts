import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import { Missing } from "../enums.js";
import { SecretRepository } from "../secrets/ports.js";
import type { AgendaResult, RunCommand } from "./interfaces.js";
import { WorkflowInstanceRepository, WorkflowRuntime } from "./ports.js";

@Injectable()
export class AnswerChildren {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly runtime: WorkflowRuntime,
    private readonly secrets: SecretRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: RunCommand): Promise<AgendaResult> {
    const parent = await this.instances.find(command.instanceId);

    if (parent === null) return { ok: false, failure: Missing.Instance };

    const ended = await this.instances.findEndedChildren(parent);

    if (ended.length === 0) return { ok: true, value: parent.agenda };

    const declared = await this.secrets.findDeclared(parent.versionId);
    const secrets = RunSecrets.of(declared);
    const now = new Date();

    for (const child of ended) {
      const awaited = parent.awaitsChild(child);

      if (!awaited) continue;

      const turn = await this.runtime.answerChild(
        parent,
        child,
        secrets,
        now,
        command.signal,
      );
      parent.advance(turn, secrets, now);
    }

    await this.unitOfWork.run(() => this.instances.save(parent));
    return { ok: true, value: parent.agenda };
  }
}
