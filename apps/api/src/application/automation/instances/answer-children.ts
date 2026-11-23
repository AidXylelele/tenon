import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import { SecretRepository } from "../secrets/ports.js";
import type { RunCommand } from "./interfaces.js";
import { InstanceEvents } from "./instance-events.js";
import { WorkflowInstanceRepository, WorkflowRuntime } from "./ports.js";

@Injectable()
export class AnswerChildren {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly runtime: WorkflowRuntime,
    private readonly secrets: SecretRepository,
    private readonly events: InstanceEvents,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: RunCommand): Promise<void> {
    const parent = await this.instances.find(command.instanceId);

    if (parent === null || parent.ended) return;

    const ended = await this.instances.findEndedChildren(parent);
    const awaited = ended.filter((child) => parent.awaitsChild(child));

    if (awaited.length === 0) return;

    const declared = await this.secrets.findDeclared(parent.versionId);
    const secrets = RunSecrets.of(declared);
    const now = new Date();

    for (const child of awaited) {
      const answerable = parent.awaitsChild(child);

      if (!answerable) continue;

      const turn = await this.runtime.answerChild(
        parent,
        child,
        secrets,
        now,
        command.signal,
      );
      parent.advance(turn, secrets, now);
    }

    await this.unitOfWork.run(async () => {
      await this.instances.save(parent);
      await this.events.dispatch(parent);
    });
  }
}
