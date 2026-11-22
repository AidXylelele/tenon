import type { Provider } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Test, type TestingModule } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import {
  AccountRepository,
  InvitationRepository,
  UserRepository,
} from "../../src/application/identity/ports.js";
import { InvitationQueries } from "../../src/application/identity/queries.js";
import type { Role } from "../../src/domain/identity/enums.js";
import { User } from "../../src/domain/identity/user.js";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../../src/frameworks/di/database.module.js";
import type { Database } from "../../src/interface-adapters/persistence/interfaces.js";
import { getDrizzleToken } from "@nestjs/drizzle";
import type { Transaction } from "../../src/interface-adapters/persistence/interfaces.js";
import { AccountMapper } from "../../src/interface-adapters/persistence/mappers/account.mapper.js";
import { InvitationMapper } from "../../src/interface-adapters/persistence/mappers/invitation.mapper.js";
import { UserMapper } from "../../src/interface-adapters/persistence/mappers/user.mapper.js";
import { PostgresInvitationQueries } from "../../src/interface-adapters/persistence/queries/postgres-invitation.queries.js";
import { PostgresAccountRepository } from "../../src/interface-adapters/persistence/repositories/postgres-account.repository.js";
import { PostgresInvitationRepository } from "../../src/interface-adapters/persistence/repositories/postgres-invitation.repository.js";
import { PostgresUserRepository } from "../../src/interface-adapters/persistence/repositories/postgres-user.repository.js";

export interface PersistenceTest {
  readonly module: TestingModule;
  readonly db: Database;
  inTransaction<T>(work: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export const userRepository: readonly Provider[] = [
  UserMapper,
  PostgresUserRepository,
  { provide: UserRepository, useExisting: PostgresUserRepository },
];

export const accountRepository: readonly Provider[] = [
  AccountMapper,
  PostgresAccountRepository,
  { provide: AccountRepository, useExisting: PostgresAccountRepository },
];

export const invitationRepository: readonly Provider[] = [
  InvitationMapper,
  PostgresInvitationRepository,
  { provide: InvitationRepository, useExisting: PostgresInvitationRepository },
];

export const invitationQueries: readonly Provider[] = [
  PostgresInvitationQueries,
  { provide: InvitationQueries, useExisting: PostgresInvitationQueries },
];

export async function createPersistenceTest(
  providers: readonly Provider[],
): Promise<PersistenceTest> {
  const bindings = Array.from(providers);
  const builder = Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    providers: bindings,
  });
  const module = await builder.compile();
  await module.init();
  const db = module.get<Database>(getDrizzleToken());
  const transactions =
    module.get<TransactionHost<Transaction>>(TransactionHost);
  return {
    module,
    db,
    inTransaction: (work) => transactions.withTransaction(work),
    close: () => module.close(),
  };
}

interface NewUser {
  readonly email: string;
  readonly name: string;
  readonly role: Role;
}

export async function addUser(
  test: PersistenceTest,
  input: NewUser,
): Promise<User> {
  const now = new Date();
  const user = User.create({
    email: input.email,
    name: input.name,
    role: input.role,
    now,
  });
  const users = test.module.get(UserRepository);
  await test.inTransaction(() => users.add(user));
  return user;
}

export async function truncateUsersAndDependents(db: Database): Promise<void> {
  await db.execute(sql`truncate table "user" cascade`);
}
