import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { type NewOutboxMessage, Outbox } from "@nestjs/outbox";
import type { WorkflowEvents } from "../../application/automation/workflows/ports.js";
import { WorkflowEventKind } from "../../domain/automation/workflows/enums.js";
import type { WorkflowEvent } from "../../domain/automation/workflows/interfaces.js";
import type { Workflow } from "../../domain/automation/workflows/workflow.js";
import type { Transaction } from "../persistence/interfaces.js";
import { MessageTopic } from "./enums.js";
import type { ScheduleFiredMessage, ScheduleMessage } from "./interfaces.js";

@Injectable()
export class WorkflowMessagesGateway implements WorkflowEvents {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly outbox: Outbox,
  ) {}

  async dispatch(workflow: Workflow): Promise<void> {
    const messages = workflow.events.map((event) => this.#messageOf(event));

    if (messages.length > 0) await this.outbox.add(this.txHost.tx, messages);

    workflow.clearEvents();
  }

  #messageOf(event: WorkflowEvent): NewOutboxMessage {
    switch (event.kind) {
      case WorkflowEventKind.ScheduleArmed:
        return this.#armedOf(event.workflowId, event.arming, event.at);
      case WorkflowEventKind.ScheduleFired:
        return this.#firedOf(event.workflowId, event.at);
    }
  }

  #armedOf(workflowId: string, arming: number, at: number): NewOutboxMessage {
    const payload: ScheduleMessage = { workflowId, arming, at };
    return {
      topic: MessageTopic.ScheduleArmed,
      key: null,
      payload,
      availableAt: at,
    };
  }

  #firedOf(workflowId: string, at: number): NewOutboxMessage {
    const payload: ScheduleFiredMessage = { workflowId, at };
    return { topic: MessageTopic.ScheduleFired, key: workflowId, payload };
  }
}
