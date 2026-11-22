import { Injectable } from "@nestjs/common";
import {
  Propagation,
  Transactional,
  TransactionHost,
} from "@nestjs-cls/transactional";
import { and, eq, lte, sql } from "drizzle-orm";
import type { Receipt } from "../../../application/automation/instances/interfaces.js";
import type { ReceivedMessages } from "../../../application/automation/instances/ports.js";
import { WaitKind } from "../../../domain/automation/instances/enums.js";
import type { Inbound } from "../../../domain/automation/instances/interfaces.js";
import type { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import type { Transaction } from "../interfaces.js";
import { InboundMapper } from "../mappers/inbound.mapper.js";
import {
  receivedMessage as messages,
  receiver as receivers,
} from "../schema/index.js";

@Injectable()
export class PostgresReceivedMessageStore implements ReceivedMessages {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly inboundMapper: InboundMapper,
  ) {}

  @Transactional(Propagation.Mandatory)
  async append(
    instance: WorkflowInstance,
    execution: string,
    inbound: Inbound,
    fence: number,
  ): Promise<number | null> {
    const held = and(
      eq(receivers.instanceId, instance.id),
      eq(receivers.execution, execution),
      lte(receivers.fence, fence),
    );
    const [claimed] = await this.txHost.tx
      .update(receivers)
      .set({ nextPosition: sql`${receivers.nextPosition} + 1`, fence })
      .where(held)
      .returning({ next: receivers.nextPosition });

    if (!claimed) return null;

    const position = claimed.next - 1;
    const sealedInbound = this.inboundMapper.sealedOf(inbound);
    await this.txHost.tx.insert(messages).values({
      instanceId: instance.id,
      execution,
      position,
      sealedInbound,
      receivedAt: new Date(),
    });
    return position;
  }

  async awaitedBy(instance: WorkflowInstance): Promise<readonly Receipt[]> {
    const receipts: Receipt[] = [];

    for (const wait of instance.waits) {
      if (wait.kind !== WaitKind.Message) continue;

      if (wait.execution === null || wait.position === null) continue;

      const [row] = await this.txHost.tx
        .select({ sealedInbound: messages.sealedInbound })
        .from(messages)
        .where(
          and(
            eq(messages.instanceId, instance.id),
            eq(messages.execution, wait.execution),
            eq(messages.position, wait.position),
          ),
        );

      if (!row) continue;

      const inbound = this.inboundMapper.inboundOf(row.sealedInbound);
      receipts.push({ wait, inbound });
    }

    return receipts;
  }

  @Transactional(Propagation.Mandatory)
  async forget(
    instance: WorkflowInstance,
    receipts: readonly Receipt[],
  ): Promise<void> {
    for (const receipt of receipts) {
      const execution = receipt.wait.execution;
      const position = receipt.wait.position;

      if (execution === null || position === null) continue;

      await this.txHost.tx
        .delete(messages)
        .where(
          and(
            eq(messages.instanceId, instance.id),
            eq(messages.execution, execution),
            eq(messages.position, position),
          ),
        );
    }
  }
}
