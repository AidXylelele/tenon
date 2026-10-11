import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../../src/interface-adapters/persistence/schema/index.js';
import {
  seedAdministrator,
  SEED_ADMIN_EMAIL,
} from '../../support/auth-helpers.js';

const db = drizzle({
  connection: process.env.DATABASE_URL ?? '',
  schema,
  casing: 'snake_case',
});

describe('bootstrap administrator migration', () => {
  beforeEach(async () => {
    await db.execute(
      sql`truncate table invitation, email_token, session, "user" cascade`,
    );
  });

  afterAll(async () => {
    await db.$client.end();
  });

  it('seeds_one_administrator_without_a_password', async () => {
    await seedAdministrator(db);
    const admins = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.role, 'admin'));
    expect(admins).toHaveLength(1);
    expect(admins[0]).toMatchObject({
      email: SEED_ADMIN_EMAIL,
      name: 'Administrator',
      passwordHash: null,
      suspended: false,
    });
  });

  it('does_nothing_while_an_administrator_exists', async () => {
    await seedAdministrator(db);
    await seedAdministrator(db);
    const users = await db.select({ id: schema.user.id }).from(schema.user);
    expect(users).toHaveLength(1);
  });
});
