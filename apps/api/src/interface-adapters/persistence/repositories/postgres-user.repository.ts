import { Injectable } from "@nestjs/common";
import {
  Propagation,
  Transactional,
  TransactionHost,
} from "@nestjs-cls/transactional";
import { eq, type SQL } from "drizzle-orm";
import { StaleWriteError } from "../../../domain/errors.js";
import type { User } from "../../../domain/identity/user.js";
import type { UserRepository } from "../../../application/identity/ports.js";
import type { Transaction } from "../interfaces.js";
import { user as users } from "../schema/index.js";
import { UserMapper } from "../mappers/user.mapper.js";

@Injectable()
export class PostgresUserRepository implements UserRepository {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly userMapper: UserMapper,
  ) {}

  @Transactional(Propagation.Mandatory)
  async add(user: User): Promise<void> {
    const row = this.userMapper.toRow(user);
    const inserted = await this.txHost.tx
      .insert(users)
      .values(row)
      .onConflictDoNothing()
      .returning({ id: users.id });

    if (inserted.length === 0) throw new StaleWriteError();
  }

  find(id: string): Promise<User | null> {
    return this.findOne(eq(users.id, id));
  }

  findByEmail(email: string): Promise<User | null> {
    return this.findOne(eq(users.email, email));
  }

  private async findOne(where: SQL | undefined): Promise<User | null> {
    const [row] = await this.txHost.tx.select().from(users).where(where);

    if (!row) return null;

    return this.userMapper.toEntity(row);
  }
}
