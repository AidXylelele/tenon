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
import { v5 } from "uuid";
import { FireSchedule } from "../../../application/automation/schedules/fire-schedule.js";
import { StartScheduledInstance } from "../../../application/automation/schedules/start-scheduled-instance.js";
import { IdNamespace, MessageTopic, SpanAttribute } from "../enums.js";
import type { ScheduleFiredMessage, ScheduleMessage } from "../interfaces.js";

@Injectable()
export class ScheduleHandler {
  private readonly tracer = trace.getTracer("tenon-api");

  constructor(
    private readonly outbox: Outbox,
    private readonly fireSchedule: FireSchedule,
    private readonly startScheduledInstance: StartScheduledInstance,
  ) {}

  @OnOutboxMessage(MessageTopic.ScheduleArmed, { consumer: "schedules" })
  async armed(
    message: ScheduleMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = {
      workflowId: message.workflowId,
      arming: message.arming,
      at: message.at,
    };
    const attributes = {
      [SpanAttribute.MessageId]: context.message.id,
      [SpanAttribute.WorkflowId]: message.workflowId,
    };
    await this.#traced(MessageTopic.ScheduleArmed, attributes, () =>
      this.fireSchedule.execute(command),
    );
    this.outbox.notify();
  }

  @OnOutboxMessage(MessageTopic.ScheduleFired, { consumer: "schedules" })
  async fired(
    message: ScheduleFiredMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const slot = `${message.workflowId}@${String(message.at)}`;
    const instanceId = v5(slot, IdNamespace.Instances);
    const command = { workflowId: message.workflowId, instanceId };
    const attributes = {
      [SpanAttribute.MessageId]: context.message.id,
      [SpanAttribute.WorkflowId]: message.workflowId,
      [SpanAttribute.InstanceId]: instanceId,
    };
    await this.#traced(MessageTopic.ScheduleFired, attributes, () =>
      this.startScheduledInstance.execute(command),
    );
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
