import { Injectable } from "@nestjs/common";
import {
  Propagation,
  Transactional,
  TransactionHost,
} from "@nestjs-cls/transactional";
import { Outbox } from "@nestjs/outbox";
import type { ChildCancellations } from "../../../application/automation/instances/ports.js";
import type { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import { MessageTopic } from "../../messaging/enums.js";
import type { InstanceMessage } from "../../messaging/interfaces.js";
import { OutboxTracer } from "../../messaging/outbox.tracer.js";
import type { Transaction } from "../interfaces.js";

@Injectable()
export class PostgresChildCancellationStore implements ChildCancellations {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly outbox: Outbox,
    private readonly tracer: OutboxTracer,
  ) {}

  @Transactional(Propagation.Mandatory)
  async request(children: readonly WorkflowInstance[]): Promise<void> {
    if (children.length === 0) return;

    const entries = children.map((child) => {
      const payload: InstanceMessage = { instanceId: child.id };
      return {
        topic: MessageTopic.CancelRequested,
        key: child.id,
        payload,
        headers: this.tracer.headers(),
      };
    });
    await this.outbox.add(this.txHost.tx, entries);
  }
}
