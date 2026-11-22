import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import { SecretRepository } from "../secrets/ports.js";
import {
  InstanceRuns,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "./ports.js";
import type { RunCommand } from "./interfaces.js";

@Injectable()
export class AnswerParent {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly runtime: WorkflowRuntime,
    private readonly secrets: SecretRepository,
    private readonly runs: InstanceRuns,
  ) {}

  @Transactional()
  async execute(command: RunCommand): Promise<void> {
    const child = await this.instances.find(command.instanceId);

    if (!child?.ended) return;

    const parentId = child.awaitedBy;

    if (parentId === null) return;

    const parent = await this.instances.find(parentId);

    if (parent === null) return;

    const awaited = parent.awaitsChild(child);

    if (!awaited) return;

    const declared = await this.secrets.findDeclared(parent.versionId);
    const secrets = RunSecrets.of(declared);
    const now = new Date();
    const turn = await this.runtime.answerChild(
      parent,
      child,
      secrets,
      now,
      command.signal,
    );
    parent.advance(turn, secrets, now);
    await this.instances.save(parent);
    await this.runs.wake(parent);
  }
}
