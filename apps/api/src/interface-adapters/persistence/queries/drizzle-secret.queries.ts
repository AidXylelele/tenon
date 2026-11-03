import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type {
  SecretQueries,
  SecretView,
} from '../../../application/automation/secrets/queries.js';
import { Cipher, type DrizzleTx } from '../interfaces.js';
import {
  secret as secrets,
  workflowInstance as instances,
  workflowVersion as versions,
} from '../schema/index.js';

@Injectable()
export class DrizzleSecretQueries implements SecretQueries {
  constructor(
    private readonly txHost: TransactionHost<DrizzleTx>,
    private readonly cipher: Cipher,
  ) {}

  list(ownerId: string): Promise<SecretView[]> {
    return this.txHost.tx
      .select({
        name: secrets.name,
        createdAt: secrets.createdAt,
        updatedAt: secrets.updatedAt,
      })
      .from(secrets)
      .where(eq(secrets.ownerId, ownerId))
      .orderBy(asc(secrets.name));
  }

  async namesOf(ownerId: string): Promise<string[]> {
    const rows = await this.txHost.tx
      .select({ name: secrets.name })
      .from(secrets)
      .where(eq(secrets.ownerId, ownerId));
    return rows.map((row) => row.name);
  }

  async valuesFor(
    instanceId: string,
    names: readonly string[],
  ): Promise<Record<string, string>> {
    const values: Record<string, string> = {};

    if (names.length === 0) return values;

    const named = names.slice();
    const rows = await this.txHost.tx
      .select({ name: secrets.name, sealed: secrets.sealed })
      .from(instances)
      .innerJoin(versions, eq(versions.id, instances.versionId))
      .innerJoin(secrets, eq(secrets.ownerId, versions.publisherId))
      .where(and(eq(instances.id, instanceId), inArray(secrets.name, named)));

    for (const row of rows) values[row.name] = this.cipher.open(row.sealed);

    return values;
  }
}
