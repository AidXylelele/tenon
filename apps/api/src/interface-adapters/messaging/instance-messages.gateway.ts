import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { type NewOutboxMessage, Outbox } from "@nestjs/outbox";
import type {
  ChildCancellations,
  InstanceMessages,
  InstanceRuns,
} from "../../application/automation/instances/ports.js";
import {
  EffectKind,
  InstanceEventKind,
} from "../../domain/automation/instances/enums.js";
import type {
  EffectAnswer,
  InstanceEvent,
} from "../../domain/automation/instances/interfaces.js";
import type { JsonObject } from "../../domain/automation/interfaces.js";
import type { WorkflowInstance } from "../../domain/automation/instances/workflow-instance.js";
import type { Transaction } from "../persistence/interfaces.js";
import { MessageTopic } from "./enums.js";
import type {
  EffectMessage,
  InstanceEndedMessage,
  InstanceMessage,
  ProcessMessage,
  RespondMessage,
  TimerMessage,
} from "./interfaces.js";
import { RunDataMapper } from "./mappers/run-data.mapper.js";

@Injectable()
export class InstanceMessagesGateway
  implements InstanceMessages, InstanceRuns, ChildCancellations
{
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly outbox: Outbox,
    private readonly runData: RunDataMapper,
  ) {}

  async dispatch(instance: WorkflowInstance): Promise<void> {
    const messages = instance.events.map((event) => this.#messageOf(event));

    if (messages.length > 0) await this.outbox.add(this.txHost.tx, messages);

    instance.clearEvents();
  }

  async respond(
    instance: WorkflowInstance,
    answer: EffectAnswer,
  ): Promise<void> {
    const sealedOutcome = this.runData.sealedOf(answer.outcome);
    const payload: RespondMessage = {
      instanceId: instance.id,
      effectId: answer.effectId,
      sealedOutcome,
    };
    const message = {
      topic: MessageTopic.RunRespond,
      key: instance.id,
      payload,
    };
    await this.outbox.add(this.txHost.tx, message);
  }

  async detach(
    instance: WorkflowInstance,
    effectId: string,
    request: JsonObject,
  ): Promise<void> {
    const sealedRequest = this.runData.sealedOf(request);
    const payload: ProcessMessage = {
      instanceId: instance.id,
      effectId,
      versionId: instance.versionId,
      sealedRequest,
    };
    const key = `${instance.id}/${effectId}`;
    const message = { topic: MessageTopic.RunProcess, key, payload };
    await this.outbox.add(this.txHost.tx, message);
  }

  async receive(instance: WorkflowInstance): Promise<void> {
    const message = this.#commandOf(MessageTopic.RunReceives, instance.id);
    await this.outbox.add(this.txHost.tx, message);
  }

  async fail(instance: WorkflowInstance): Promise<void> {
    const message = this.#commandOf(MessageTopic.RunFail, instance.id);
    await this.outbox.add(this.txHost.tx, message);
  }

  async request(children: readonly WorkflowInstance[]): Promise<void> {
    const messages = children.map((child) =>
      this.#commandOf(MessageTopic.CancelRequested, child.id),
    );

    if (messages.length > 0) await this.outbox.add(this.txHost.tx, messages);
  }

  #messageOf(event: InstanceEvent): NewOutboxMessage {
    switch (event.kind) {
      case InstanceEventKind.Started:
        return this.#commandOf(MessageTopic.RunBegin, event.instanceId);
      case InstanceEventKind.EffectRequested:
        return this.#effectOf(event.instanceId, event.effectId, event.effect);
      case InstanceEventKind.TimerSet:
        return this.#timerOf(event.instanceId, event.effectId, event.at);
      case InstanceEventKind.Ended:
        return this.#endedOf(event.instanceId, event.parentId);
      case InstanceEventKind.ChildrenAbandoned:
        return this.#commandOf(
          MessageTopic.ChildrenAbandoned,
          event.instanceId,
        );
    }
  }

  #commandOf(topic: MessageTopic, instanceId: string): NewOutboxMessage {
    const payload: InstanceMessage = { instanceId };
    return { topic, key: instanceId, payload };
  }

  #effectOf(
    instanceId: string,
    effectId: string,
    effect: EffectKind,
  ): NewOutboxMessage {
    if (effect === EffectKind.Receive)
      return this.#commandOf(MessageTopic.RunReceives, instanceId);

    const payload: EffectMessage = { instanceId, effectId, effect };
    const key = `${instanceId}/${effectId}`;
    return { topic: MessageTopic.RunEffect, key, payload };
  }

  #timerOf(instanceId: string, effectId: string, at: number): NewOutboxMessage {
    const payload: TimerMessage = { instanceId, effectId, at };
    const key = `${instanceId}/${effectId}/${String(at)}`;
    return { topic: MessageTopic.RunTimer, key, payload, availableAt: at };
  }

  #endedOf(instanceId: string, parentId: string | null): NewOutboxMessage {
    const payload: InstanceEndedMessage = { instanceId, parentId };
    const key = parentId ?? instanceId;
    return { topic: MessageTopic.InstanceEnded, key, payload };
  }
}
