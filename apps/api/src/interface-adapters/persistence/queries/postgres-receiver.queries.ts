import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { ReceiverView } from "../../../application/automation/instances/interfaces.js";
import type { ReceiverQueries } from "../../../application/automation/instances/queries.js";
import type { Transaction } from "../interfaces.js";
import {
  receiver as receivers,
  workflowInstance as instances,
} from "../schema/index.js";

@Injectable()
export class PostgresReceiverQueries implements ReceiverQueries {
  constructor(private readonly txHost: TransactionHost<Transaction>) {}

  open(): Promise<readonly ReceiverView[]> {
    return this.txHost.tx
      .select({
        instanceId: receivers.instanceId,
        execution: receivers.execution,
        request: receivers.request,
        closesAt: receivers.closesAt,
      })
      .from(receivers)
      .innerJoin(instances, eq(instances.id, receivers.instanceId))
      .where(
        and(
          isNull(instances.endedAt),
          or(isNull(receivers.closesAt), gt(receivers.closesAt, sql`now()`)),
        ),
      );
  }

  async demands(instanceId: string, execution: string): Promise<boolean> {
    const [row] = await this.txHost.tx
      .select({ execution: receivers.execution })
      .from(receivers)
      .where(
        and(
          eq(receivers.instanceId, instanceId),
          eq(receivers.execution, execution),
          eq(receivers.awaiting, receivers.nextPosition),
        ),
      );
    return row !== undefined;
  }
}
