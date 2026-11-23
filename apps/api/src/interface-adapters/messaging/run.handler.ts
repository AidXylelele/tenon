import { Injectable } from "@nestjs/common";
import {
  OnOutboxMessage,
  Outbox,
  type OutboxHandlerContext,
} from "@nestjs/outbox";
import { AnswerChildren } from "../../application/automation/instances/answer-children.js";
import { AnswerReceives } from "../../application/automation/instances/answer-receives.js";
import { BeginRun } from "../../application/automation/instances/begin-run.js";
import { FailRun } from "../../application/automation/instances/fail-run.js";
import { RespondToEffect } from "../../application/automation/instances/respond-to-effect.js";
import { InstanceEventKind } from "../../domain/automation/instances/enums.js";
import { PermanentFault } from "../workflows/permanent-fault.error.js";
import { ConsumerSpan } from "./consumer-span.js";
import { MessageTopic } from "./enums.js";
import type {
  InstanceEndedMessage,
  InstanceMessage,
  RespondMessage,
} from "./interfaces.js";

@Injectable()
export class RunHandler {
  static readonly ATTEMPTS = 10;

  constructor(
    private readonly span: ConsumerSpan,
    private readonly outbox: Outbox,
    private readonly beginRun: BeginRun,
    private readonly respondToEffect: RespondToEffect,
    private readonly answerChildren: AnswerChildren,
    private readonly answerReceives: AnswerReceives,
    private readonly failRun: FailRun,
  ) {}

  @OnOutboxMessage(MessageTopic.RunBegin, { consumer: "runs" })
  begun(
    message: InstanceMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = { instanceId: message.instanceId, signal: context.signal };
    return this.#played(context, message.instanceId, () =>
      this.beginRun.execute(command),
    );
  }

  @OnOutboxMessage(MessageTopic.RunRespond, { consumer: "runs" })
  responded(
    message: RespondMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const answer = { effectId: message.effectId, outcome: message.outcome };
    const command = {
      instanceId: message.instanceId,
      answer,
      signal: context.signal,
    };
    return this.#played(context, message.instanceId, () =>
      this.respondToEffect.execute(command),
    );
  }

  @OnOutboxMessage(MessageTopic.RunReceives, { consumer: "runs" })
  received(
    message: InstanceMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = { instanceId: message.instanceId, signal: context.signal };
    return this.#played(context, message.instanceId, () =>
      this.answerReceives.execute(command),
    );
  }

  @OnOutboxMessage(InstanceEventKind.Ended, { consumer: "parents" })
  async childEnded(
    message: InstanceEndedMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const parentId = message.parentId;

    if (parentId === null) return;

    const command = { instanceId: parentId, signal: context.signal };
    await this.#played(context, parentId, () =>
      this.answerChildren.execute(command),
    );
  }

  @OnOutboxMessage(MessageTopic.RunFail, { consumer: "runs" })
  async failed(
    message: InstanceMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = { instanceId: message.instanceId };
    await this.span.around(context, () => this.failRun.execute(command));
    this.outbox.notify();
  }

  async #played(
    context: OutboxHandlerContext,
    instanceId: string,
    work: () => Promise<void>,
  ): Promise<void> {
    try {
      await this.span.around(context, work);
    } catch (error) {
      const permanent = error instanceof PermanentFault;
      const exhausted = context.attempt >= RunHandler.ATTEMPTS;

      if (!permanent && !exhausted) throw error;

      await this.failRun.execute({ instanceId });
    }

    this.outbox.notify();
  }
}
