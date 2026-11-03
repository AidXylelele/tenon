import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { and, eq, sql } from 'drizzle-orm';
import type { SecretRepository } from '../../../application/automation/secrets/ports.js';
import type { Secret } from '../../../domain/automation/secrets/secret.js';
import { StaleWriteError } from '../../../domain/errors.js';
import { Cipher, type DrizzleTx } from '../interfaces.js';
import { SecretMapper } from '../mappers/secret.mapper.js';
import { secret as secrets } from '../schema/index.js';
import { UniqueViolation } from '../unique-violation.js';

@Injectable()
export class DrizzleSecretRepository implements SecretRepository {
  constructor(
    private readonly txHost: TransactionHost<DrizzleTx>,
    private readonly cipher: Cipher,
  ) {}

  async find(ownerId: string, name: string): Promise<Secret | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(secrets)
      .where(and(eq(secrets.ownerId, ownerId), eq(secrets.name, name)));

    if (!row) return null;

    return SecretMapper.toEntity(row, this.cipher);
  }

  // An upsert fenced by the secret's version; a name its owner took meanwhile is a stale write.
  @Transactional(Propagation.Mandatory)
  async save(secret: Secret): Promise<void> {
    const row = SecretMapper.toRow(secret, this.cipher);
    const nextVersion = secret.version + 1;
    const upsert = this.txHost.tx
      .insert(secrets)
      .values({ ...row, version: nextVersion })
      .onConflictDoUpdate({
        target: secrets.id,
        set: {
          sealed: sql`excluded.sealed`,
          updatedAt: sql`excluded.updated_at`,
          version: sql`excluded.version`,
        },
        setWhere: eq(secrets.version, secret.version),
      })
      .returning({ id: secrets.id });
    const saved = await UniqueViolation.translated(
      upsert,
      () => new StaleWriteError(),
    );

    if (saved.length === 0) throw new StaleWriteError();
  }

  @Transactional(Propagation.Mandatory)
  async remove(secret: Secret): Promise<void> {
    await this.txHost.tx.delete(secrets).where(eq(secrets.id, secret.id));
  }
}
