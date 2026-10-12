import { Account } from '../../../domain/account.js';
import type { AccountRow } from '../../interfaces.js';

export class AccountMapper {
  static toRow(account: Account): AccountRow {
    return {
      id: account.id,
      userId: account.userId,
      type: account.type,
      identifier: account.identifier,
      config: { passwordHash: account.passwordHash ?? undefined },
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      version: account.version,
    };
  }

  static toEntity(row: AccountRow): Account {
    return new Account({
      id: row.id,
      userId: row.userId,
      type: row.type,
      identifier: row.identifier,
      passwordHash: row.config.passwordHash ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
    });
  }
}
