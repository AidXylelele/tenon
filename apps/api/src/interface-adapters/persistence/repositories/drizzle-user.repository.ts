import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq, type SQL } from 'drizzle-orm';
import { UserNotFoundError } from '../../../domain/errors.js';
import type { User } from '../../../domain/user.js';
import type { UserRepository } from '../../../application/interfaces.js';
import type { DrizzleTx } from '../../interfaces.js';
import { user as users } from '../schema/index.js';
import { UserMapper } from '../mappers/user.mapper.js';

@Injectable()
export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async add(user: User): Promise<void> {
    await this.txHost.tx.insert(users).values(UserMapper.toRow(user));
  }

  async update(user: User): Promise<void> {
    await this.txHost.tx
      .update(users)
      .set(UserMapper.toRow(user))
      .where(eq(users.id, user.id));
  }

  async getById(id: string): Promise<User> {
    const user = await this.findOne(eq(users.id, id));

    if (!user) throw new UserNotFoundError();

    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.findOne(eq(users.email, email.toLowerCase()));
  }

  findActiveById(id: string): Promise<User | null> {
    return this.findOne(and(eq(users.id, id), eq(users.suspended, false)));
  }

  findActiveByEmail(email: string): Promise<User | null> {
    return this.findOne(
      and(eq(users.email, email.toLowerCase()), eq(users.suspended, false)),
    );
  }

  private async findOne(where: SQL | undefined): Promise<User | null> {
    const [row] = await this.txHost.tx.select().from(users).where(where);

    if (!row) return null;

    return UserMapper.toEntity(row);
  }
}
