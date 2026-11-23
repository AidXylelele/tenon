import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { type NewOutboxMessage, Outbox } from "@nestjs/outbox";
import type {
  InstanceEvents,
  InstanceRuns,
} from "../../application/automation/instances/ports.js";
import { InstanceEventKind } from "../../domain/automation/instances/enums.js";
import type {
  EffectAnswer,
  InstanceEvent,
} from "../../domain/automation/instances/interfaces.js";
import type { WorkflowInstance } from "../../domain/automation/instances/workflow-instance.js";
import type { Transaction } from "../persistence/interfaces.js";
import { MessageTopic } from "./enums.js";
import type {
  EffectMessage,
  InstanceEndedMessage,
  InstanceMessage,
  RespondMessage,
  TimerMessage,
} from "./interfaces.js";

@Injectable()
export class InstanceMessagesGateway implements InstanceEvents, InstanceRuns {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly outbox: Outbox,
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
    const payload: RespondMessage = {
      instanceId: instance.id,
      effectId: answer.effectId,
      outcome: answer.outcome,
    };
    const message = {
      topic: MessageTopic.RunRespond,
      key: instance.id,
      payload,
    };
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

  #messageOf(event: InstanceEvent): NewOutboxMessage {
    switch (event.kind) {
      case InstanceEventKind.Started:
        return this.#commandOf(MessageTopic.RunBegin, event.instanceId);
      case InstanceEventKind.EffectRequested:
        return this.#effectOf(event.instanceId, event.effectId);
      case InstanceEventKind.TimerSet:
        return this.#timerOf(event.instanceId, event.effectId, event.at);
      case InstanceEventKind.Ended:
      case InstanceEventKind.ChildrenAbandoned:
        return this.#endedOf(event.kind, event.instanceId, event.parentId);
    }
  }

  #commandOf(topic: MessageTopic, instanceId: string): NewOutboxMessage {
    const payload: InstanceMessage = { instanceId };
    return { topic, key: instanceId, payload };
  }

  #effectOf(instanceId: string, effectId: string): NewOutboxMessage {
    const payload: EffectMessage = { instanceId, effectId };
    const key = `${instanceId}/${effectId}`;
    return { topic: MessageTopic.RunEffect, key, payload };
  }

  #timerOf(instanceId: string, effectId: string, at: number): NewOutboxMessage {
    const payload: TimerMessage = { instanceId, effectId, at };
    const key = `${instanceId}/${effectId}/${String(at)}`;
    return { topic: MessageTopic.RunTimer, key, payload, availableAt: at };
  }

  #endedOf(
    topic: InstanceEventKind,
    instanceId: string,
    parentId: string | null,
  ): NewOutboxMessage {
    const payload: InstanceEndedMessage = { instanceId, parentId };
    const key = parentId ?? instanceId;
    return { topic, key, payload };
  }
}
