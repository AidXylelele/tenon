import { Injectable } from "@nestjs/common";
import { Account } from "../../../domain/identity/accounts/account.js";
import type { AccountRow } from "../interfaces.js";

@Injectable()
export class AccountMapper {
  toRow(account: Account): AccountRow {
    return {
      id: account.id,
      userId: account.userId,
      identifier: account.identifier,
      passwordHash: account.passwordHash,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      version: account.version,
    };
  }

  toEntity(row: AccountRow): Account {
    return new Account({
      id: row.id,
      userId: row.userId,
      identifier: row.identifier,
      passwordHash: row.passwordHash,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
    });
  }
}
