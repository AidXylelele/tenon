import { Injectable } from "@nestjs/common";
import {
  Propagation,
  Transactional,
  TransactionHost,
} from "@nestjs-cls/transactional";
import { and, eq, type SQL } from "drizzle-orm";
import type { Account } from "../../../domain/identity/accounts/account.js";
import { StaleWriteError } from "../../../domain/errors.js";
import type { AccountRepository } from "../../../application/identity/accounts/ports.js";
import type { AccountRow, Transaction } from "../interfaces.js";
import { AccountMapper } from "../mappers/account.mapper.js";
import { account as accounts } from "../schema/index.js";

@Injectable()
export class PostgresAccountRepository implements AccountRepository {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly accountMapper: AccountMapper,
  ) {}

  @Transactional(Propagation.Mandatory)
  async save(account: Account): Promise<void> {
    const row = this.accountMapper.toRow(account);
    const version = account.version + 1;

    if (account.version === 0) {
      await this.#insert({ ...row, version });
      return;
    }

    const saved = await this.txHost.tx
      .update(accounts)
      .set({
        passwordHash: row.passwordHash,
        updatedAt: row.updatedAt,
        version,
      })
      .where(
        and(eq(accounts.id, row.id), eq(accounts.version, account.version)),
      )
      .returning({ id: accounts.id });

    if (saved.length === 0) throw new StaleWriteError();
  }

  findByEmail(email: string): Promise<Account | null> {
    return this.#findOne(eq(accounts.identifier, email));
  }

  findByUserId(userId: string): Promise<Account | null> {
    return this.#findOne(eq(accounts.userId, userId));
  }

  async #insert(row: AccountRow): Promise<void> {
    const inserted = await this.txHost.tx
      .insert(accounts)
      .values(row)
      .onConflictDoNothing()
      .returning({ id: accounts.id });

    if (inserted.length === 0) throw new StaleWriteError();
  }

  async #findOne(where: SQL): Promise<Account | null> {
    const [row] = await this.txHost.tx.select().from(accounts).where(where);

    if (!row) return null;

    return this.accountMapper.toEntity(row);
  }
}
