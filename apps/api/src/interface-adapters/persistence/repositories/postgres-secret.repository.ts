import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { and, eq, inArray } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import type { SecretRepository } from "../../../application/automation/secrets/ports.js";
import type { Secret } from "../../../domain/automation/secrets/secret.js";
import { StaleWriteError } from "../../../domain/stale-write.error.js";
import type { DeclaredSecrets, Transaction } from "../interfaces.js";
import { SecretMapper } from "../mappers/secret.mapper.js";
import {
  secret as secrets,
  workflowVersion as versions,
} from "../schema/index.js";

@Injectable()
export class PostgresSecretRepository implements SecretRepository {
  private static readonly MOST_CACHED_VERSIONS = 10_000;

  private readonly declaredSecrets = new LRUCache<string, DeclaredSecrets>({
    max: PostgresSecretRepository.MOST_CACHED_VERSIONS,
    fetchMethod: (versionId) => this.#declaredBy(versionId),
  });

  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly secretMapper: SecretMapper,
  ) {}

  async find(ownerId: string, name: string): Promise<Secret | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(secrets)
      .where(and(eq(secrets.ownerId, ownerId), eq(secrets.name, name)));

    if (!row) return null;

    return this.secretMapper.toEntity(row);
  }

  async findOwnedBy(ownerId: string): Promise<Secret[]> {
    const rows = await this.txHost.tx
      .select()
      .from(secrets)
      .where(eq(secrets.ownerId, ownerId));
    return rows.map((row) => this.secretMapper.toEntity(row));
  }

  async findDeclared(versionId: string): Promise<Secret[]> {
    const declared = await this.declaredSecrets.fetch(versionId);

    if (declared === undefined || declared.names.length === 0) return [];

    const names = declared.names.slice();
    const rows = await this.txHost.tx
      .select()
      .from(secrets)
      .where(
        and(
          eq(secrets.ownerId, declared.publisherId),
          inArray(secrets.name, names),
        ),
      );
    return rows.map((row) => this.secretMapper.toEntity(row));
  }

  async save(secret: Secret): Promise<void> {
    const row = this.secretMapper.toRow(secret);
    const nextVersion = secret.version + 1;
    const saved =
      secret.version === 0
        ? await this.txHost.tx
            .insert(secrets)
            .values({ ...row, version: nextVersion })
            .onConflictDoNothing()
            .returning({ id: secrets.id })
        : await this.txHost.tx
            .update(secrets)
            .set({
              sealed: row.sealed,
              updatedAt: row.updatedAt,
              version: nextVersion,
            })
            .where(
              and(eq(secrets.id, row.id), eq(secrets.version, secret.version)),
            )
            .returning({ id: secrets.id });

    if (saved.length === 0) throw new StaleWriteError();
  }

  async remove(secret: Secret): Promise<void> {
    await this.txHost.tx.delete(secrets).where(eq(secrets.id, secret.id));
  }

  async #declaredBy(versionId: string): Promise<DeclaredSecrets | undefined> {
    const [row] = await this.txHost.tx
      .select({
        publisherId: versions.publisherId,
        names: versions.secrets,
      })
      .from(versions)
      .where(eq(versions.id, versionId));
    return row;
  }
}
