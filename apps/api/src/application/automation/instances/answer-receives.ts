import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import { Missing } from "../enums.js";
import { SecretRepository } from "../secrets/ports.js";
import type { AgendaResult, Receipt, RunCommand } from "./interfaces.js";
import {
  ReceivedMessages,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "./ports.js";

@Injectable()
export class AnswerReceives {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly messages: ReceivedMessages,
    private readonly runtime: WorkflowRuntime,
    private readonly secrets: SecretRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: RunCommand): Promise<AgendaResult> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return { ok: false, failure: Missing.Instance };

    const receipts = await this.messages.awaitedBy(instance);

    if (receipts.length === 0) return { ok: true, value: instance.agenda };

    const declared = await this.secrets.findDeclared(instance.versionId);
    const secrets = RunSecrets.of(declared);
    const now = new Date();

    const answered: Receipt[] = [];

    for (const receipt of receipts) {
      const awaited = instance.awaits(receipt.wait.effectId);

      if (!awaited) continue;

      const turn = await this.runtime.receive(
        instance,
        receipt,
        secrets,
        now,
        command.signal,
      );
      instance.advance(turn, secrets, now);
      answered.push(receipt);
    }

    await this.unitOfWork.run(async () => {
      await this.messages.forget(instance, answered);
      await this.instances.save(instance);
    });
    return { ok: true, value: instance.agenda };
  }
}
