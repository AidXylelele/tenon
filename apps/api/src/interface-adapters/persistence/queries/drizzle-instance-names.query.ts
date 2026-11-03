import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { eq } from 'drizzle-orm';
import type { DrizzleTx } from '../interfaces.js';
import type { InstanceNames } from '../mappers/lifecycle-event.mapper.js';
import {
  workflow as workflows,
  workflowInstance as instances,
  workflowVersion as versions,
} from '../schema/index.js';

// The names an instance's lifecycle events carry; they never change, so they are kept once read.
@Injectable()
export class DrizzleInstanceNames {
  private static readonly KEPT = 10_000;

  private readonly kept = new Map<string, InstanceNames>();

  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async of(instanceId: string): Promise<InstanceNames | null> {
    const known = this.kept.get(instanceId);

    if (known !== undefined) return known;

    const [row] = await this.txHost.tx
      .select({
        namespace: workflows.namespace,
        name: workflows.name,
        version: versions.semver,
      })
      .from(instances)
      .innerJoin(workflows, eq(workflows.id, instances.workflowId))
      .innerJoin(versions, eq(versions.id, instances.versionId))
      .where(eq(instances.id, instanceId));

    if (!row) return null;

    if (this.kept.size >= DrizzleInstanceNames.KEPT) this.kept.clear();

    this.kept.set(instanceId, row);
    return row;
  }
}
