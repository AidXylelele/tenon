import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { and, eq, type SQL, sql } from 'drizzle-orm';
import type { Account } from '../../../domain/identity/account.js';
import type { AccountType } from '../../../domain/identity/enums.js';
import {
  AccountConflictError,
  AccountExistsError,
} from '../../../domain/errors.js';
import type { AccountRepository } from '../../../application/identity/ports.js';
import type { DrizzleTx } from '../interfaces.js';
import { AccountMapper } from '../mappers/account.mapper.js';
import { account as accounts } from '../schema/index.js';
import { isUniqueViolation } from '../unique-violation.js';

@Injectable()
export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  @Transactional(Propagation.Mandatory)
  async save(account: Account): Promise<void> {
    const row = AccountMapper.toRow(account);
    const version = account.version + 1;
    const upsert = this.txHost.tx
      .insert(accounts)
      .values({ ...row, version })
      .onConflictDoUpdate({
        target: accounts.id,
        set: {
          config: sql`excluded.config`,
          updatedAt: sql`excluded.updated_at`,
          version: sql`excluded.version`,
        },
        setWhere: eq(accounts.version, account.version),
      })
      .returning({ id: accounts.id });

    try {
      const saved = await upsert;

      if (saved.length === 0) throw new AccountConflictError();
    } catch (error) {
      if (isUniqueViolation(error)) throw new AccountExistsError();

      throw error;
    }
  }

  findByIdentifier(
    type: AccountType,
    identifier: string,
  ): Promise<Account | null> {
    return this.findOne(
      and(eq(accounts.type, type), eq(accounts.identifier, identifier)),
    );
  }

  findByUserId(userId: string, type: AccountType): Promise<Account | null> {
    return this.findOne(
      and(eq(accounts.userId, userId), eq(accounts.type, type)),
    );
  }

  private async findOne(where: SQL | undefined): Promise<Account | null> {
    const [row] = await this.txHost.tx.select().from(accounts).where(where);

    if (!row) return null;

    return AccountMapper.toEntity(row);
  }
}
