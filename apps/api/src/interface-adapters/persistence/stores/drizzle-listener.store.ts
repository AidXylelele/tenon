import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';
import type {
  Listener,
  ListenerStore,
} from '../../../application/automation/events/ports.js';
import type { DrizzleTx } from '../interfaces.js';
import {
  listener as listeners,
  workflowInstance as instances,
} from '../schema/index.js';

@Injectable()
export class DrizzleListenerStore implements ListenerStore {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async add(
    instanceId: string,
    key: string,
    types: string[] | null,
  ): Promise<void> {
    const since = new Date();
    await this.txHost.tx
      .insert(listeners)
      .values({ instanceId, key, types, since })
      .onConflictDoNothing();
  }

  async remove(instanceId: string, key: string): Promise<void> {
    await this.txHost.tx
      .delete(listeners)
      .where(and(eq(listeners.instanceId, instanceId), eq(listeners.key, key)));
  }

  ofType(type: string, acceptedAt: Date): Promise<Listener[]> {
    const takes = or(
      isNull(listeners.types),
      sql`${type} = any(${listeners.types})`,
    );
    return this.txHost.tx
      .select({ instanceId: listeners.instanceId, key: listeners.key })
      .from(listeners)
      .innerJoin(instances, eq(instances.id, listeners.instanceId))
      .where(
        and(takes, lte(listeners.since, acceptedAt), isNull(instances.endedAt)),
      );
  }
}
