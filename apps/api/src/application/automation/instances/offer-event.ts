import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import { EventStore } from "../events/ports.js";
import { SecretRepository } from "../secrets/ports.js";
import {
  InstanceEvents,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "./ports.js";
import type { OfferCommand } from "./interfaces.js";

@Injectable()
export class OfferEvent {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly events: EventStore,
    private readonly runtime: WorkflowRuntime,
    private readonly secrets: SecretRepository,
    private readonly instanceEvents: InstanceEvents,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: OfferCommand): Promise<void> {
    const event = await this.events.find(command.sequence);
    const instance = await this.instances.find(command.instanceId);

    if (event === null || instance === null) return;

    const offer = {
      eventId: event.eventId,
      event: event.cloudEvent,
      candidates: command.candidates,
    };
    const takes = instance.mayTake(offer);

    if (!takes) return;

    const declared = await this.secrets.findDeclared(instance.versionId);
    const secrets = RunSecrets.of(declared);
    const now = new Date();
    const turn = await this.runtime.offer(
      instance,
      offer,
      secrets,
      now,
      command.signal,
    );
    instance.advance(turn, secrets, now);
    await this.unitOfWork.run(async () => {
      await this.instances.save(instance);
      await this.instanceEvents.dispatch(instance);
    });
  }
}
