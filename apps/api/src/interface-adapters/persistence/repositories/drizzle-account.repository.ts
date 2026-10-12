import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq, type SQL } from 'drizzle-orm';
import type { Account } from '../../../domain/account.js';
import type { AccountType } from '../../../domain/enums.js';
import {
  AccountConflictError,
  AccountExistsError,
} from '../../../domain/errors.js';
import type { AccountRepository } from '../../../application/interfaces.js';
import type { DrizzleTx } from '../../interfaces.js';
import { AccountMapper } from '../mappers/account.mapper.js';
import { account as accounts } from '../schema/index.js';

@Injectable()
export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async add(account: Account): Promise<void> {
    const inserted = await this.txHost.tx
      .insert(accounts)
      .values(AccountMapper.toRow(account))
      .onConflictDoNothing()
      .returning({ id: accounts.id });

    if (inserted.length === 0) throw new AccountExistsError();
  }

  async update(account: Account): Promise<void> {
    const updated = await this.txHost.tx
      .update(accounts)
      .set({ ...AccountMapper.toRow(account), version: account.version + 1 })
      .where(
        and(eq(accounts.id, account.id), eq(accounts.version, account.version)),
      )
      .returning({ id: accounts.id });

    if (updated.length === 0) throw new AccountConflictError();
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
