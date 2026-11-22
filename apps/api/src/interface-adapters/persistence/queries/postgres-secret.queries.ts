import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { and, asc, eq, sql } from "drizzle-orm";
import type { SecretQueries } from "../../../application/automation/secrets/queries.js";
import type {
  ListedSecret,
  SecretUse,
} from "../../../application/automation/secrets/interfaces.js";
import type { HeldSecret } from "../../../domain/automation/secrets/interfaces.js";
import { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import type { Transaction } from "../interfaces.js";
import { SecretMapper } from "../mappers/secret.mapper.js";
import {
  secret as secrets,
  workflow as workflows,
  workflowInstance as instances,
  workflowVersion as versions,
} from "../schema/index.js";

@Injectable()
export class PostgresSecretQueries implements SecretQueries {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly secretMapper: SecretMapper,
  ) {}

  async list(ownerId: string): Promise<ListedSecret[]> {
    const rows = await this.txHost.tx
      .select({
        name: secrets.name,
        createdAt: secrets.createdAt,
        updatedAt: secrets.updatedAt,
      })
      .from(secrets)
      .where(eq(secrets.ownerId, ownerId))
      .orderBy(asc(secrets.name));
    const uses = await this.#usesOf(ownerId);
    return rows.map((row) => ({
      name: row.name,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      usedBy: uses.get(row.name) ?? [],
    }));
  }

  async ofInstance(instanceId: string): Promise<RunSecrets> {
    const declared = sql`${secrets.name} = any(${versions.secrets})`;
    const rows = await this.txHost.tx
      .select({ name: secrets.name, sealed: secrets.sealed })
      .from(instances)
      .innerJoin(versions, eq(versions.id, instances.versionId))
      .innerJoin(secrets, eq(secrets.ownerId, versions.publisherId))
      .where(and(eq(instances.id, instanceId), declared));
    const held = rows.map((row) => this.secretMapper.heldOf(row));
    return RunSecrets.of(held);
  }

  async heldBy(ownerId: string, name: string): Promise<HeldSecret | null> {
    const [row] = await this.txHost.tx
      .select({ name: secrets.name, sealed: secrets.sealed })
      .from(secrets)
      .where(and(eq(secrets.ownerId, ownerId), eq(secrets.name, name)));

    if (!row) return null;

    return this.secretMapper.heldOf(row);
  }

  async #usesOf(
    ownerId: string,
  ): Promise<ReadonlyMap<string, readonly SecretUse[]>> {
    const declared = sql`${secrets.name} = any(${versions.secrets})`;
    const rows = await this.txHost.tx
      .select({
        secret: secrets.name,
        namespace: workflows.namespace,
        name: workflows.name,
        version: versions.semver,
      })
      .from(secrets)
      .innerJoin(
        versions,
        and(eq(versions.publisherId, secrets.ownerId), declared),
      )
      .innerJoin(workflows, eq(workflows.currentVersionId, versions.id))
      .where(eq(secrets.ownerId, ownerId))
      .orderBy(asc(workflows.namespace), asc(workflows.name));
    const uses = new Map<string, SecretUse[]>();

    for (const row of rows) {
      const use = {
        namespace: row.namespace,
        name: row.name,
        version: row.version,
      };
      const known = uses.get(row.secret) ?? [];
      known.push(use);
      uses.set(row.secret, known);
    }

    return uses;
  }
}
