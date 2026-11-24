import { Injectable } from "@nestjs/common";
import {
  OnOutboxMessage,
  Outbox,
  type OutboxHandlerContext,
} from "@nestjs/outbox";
import {
  type Attributes,
  type Span,
  SpanKind,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import { AnswerChildren } from "../../../application/automation/instances/answer-children.js";
import { AnswerReceives } from "../../../application/automation/instances/answer-receives.js";
import { BeginRun } from "../../../application/automation/instances/begin-run.js";
import { FailRun } from "../../../application/automation/instances/fail-run.js";
import { RespondToEffect } from "../../../application/automation/instances/respond-to-effect.js";
import { PermanentFault } from "../../interpreter/permanent-fault.error.js";
import { MessageTopic, SpanAttribute } from "../enums.js";
import type {
  ChildEndedMessage,
  InstanceMessage,
  RespondMessage,
} from "../interfaces.js";
import { RunDataMapper } from "../mappers/run-data.mapper.js";
import { MessageRetries } from "../message-retries.js";

@Injectable()
export class RunHandler {
  private readonly tracer = trace.getTracer("tenon-api");

  constructor(
    private readonly outbox: Outbox,
    private readonly retries: MessageRetries,
    private readonly runData: RunDataMapper,
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
    const attributes = {
      [SpanAttribute.MessageId]: context.message.id,
      [SpanAttribute.InstanceId]: message.instanceId,
    };
    const traced = () =>
      this.#traced(MessageTopic.RunBegin, attributes, () =>
        this.beginRun.execute(command),
      );
    return this.#played(context, message.instanceId, traced);
  }

  @OnOutboxMessage(MessageTopic.RunRespond, { consumer: "runs" })
  responded(
    message: RespondMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const outcome = this.runData.dataOf(message.sealedOutcome);
    const answer = { effectId: message.effectId, outcome };
    const command = {
      instanceId: message.instanceId,
      answer,
      signal: context.signal,
    };
    const attributes = {
      [SpanAttribute.MessageId]: context.message.id,
      [SpanAttribute.InstanceId]: message.instanceId,
      [SpanAttribute.EffectId]: message.effectId,
    };
    const traced = () =>
      this.#traced(MessageTopic.RunRespond, attributes, () =>
        this.respondToEffect.execute(command),
      );
    return this.#played(context, message.instanceId, traced);
  }

  @OnOutboxMessage(MessageTopic.RunReceives, { consumer: "runs" })
  received(
    message: InstanceMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = { instanceId: message.instanceId, signal: context.signal };
    const attributes = {
      [SpanAttribute.MessageId]: context.message.id,
      [SpanAttribute.InstanceId]: message.instanceId,
    };
    const traced = () =>
      this.#traced(MessageTopic.RunReceives, attributes, () =>
        this.answerReceives.execute(command),
      );
    return this.#played(context, message.instanceId, traced);
  }

  @OnOutboxMessage(MessageTopic.ChildEnded, { consumer: "parents" })
  childEnded(
    message: ChildEndedMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = { instanceId: message.parentId, signal: context.signal };
    const attributes = {
      [SpanAttribute.MessageId]: context.message.id,
      [SpanAttribute.InstanceId]: message.instanceId,
      [SpanAttribute.ParentId]: message.parentId,
    };
    const traced = () =>
      this.#traced(MessageTopic.ChildEnded, attributes, () =>
        this.answerChildren.execute(command),
      );
    return this.#played(context, message.parentId, traced);
  }

  @OnOutboxMessage(MessageTopic.RunFail, { consumer: "runs" })
  async failed(
    message: InstanceMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = { instanceId: message.instanceId };
    const attributes = {
      [SpanAttribute.MessageId]: context.message.id,
      [SpanAttribute.InstanceId]: message.instanceId,
    };
    await this.#traced(MessageTopic.RunFail, attributes, () =>
      this.failRun.execute(command),
    );
    this.outbox.notify();
  }

  async #played(
    context: OutboxHandlerContext,
    instanceId: string,
    work: () => Promise<void>,
  ): Promise<void> {
    try {
      await work();
    } catch (error) {
      const permanent = error instanceof PermanentFault;
      const exhausted = this.retries.exhausted(context);

      if (!permanent && !exhausted) throw error;

      await this.failRun.execute({ instanceId });
    }

    this.outbox.notify();
  }

  #traced(
    topic: MessageTopic,
    attributes: Attributes,
    work: () => Promise<void>,
  ): Promise<void> {
    const name = `process ${topic}`;
    const options = {
      kind: SpanKind.CONSUMER,
      attributes: {
        [SpanAttribute.System]: "outbox",
        [SpanAttribute.OperationName]: "process",
        [SpanAttribute.OperationType]: "process",
        [SpanAttribute.Destination]: topic,
      },
    };
    return this.tracer.startActiveSpan(name, options, (span) =>
      this.#ended(span, attributes, work),
    );
  }

  async #ended(
    span: Span,
    attributes: Attributes,
    work: () => Promise<void>,
  ): Promise<void> {
    span.setAttributes(attributes);

    try {
      await work();
    } catch (error) {
      this.#failed(span, error);
      throw error;
    } finally {
      span.end();
    }
  }

  #failed(span: Span, error: unknown): void {
    if (!(error instanceof Error)) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      return;
    }

    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  }
}
