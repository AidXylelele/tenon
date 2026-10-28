import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

const migrationsUpTo = (tag: string): string => {
  const folder = mkdtempSync(join(tmpdir(), 'migrations-'));
  cpSync(MIGRATIONS, folder, { recursive: true });
  const journalFile = join(folder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalFile, 'utf8')) as {
    entries: { tag: string }[];
  };
  const last = journal.entries.findIndex((entry) => entry.tag === tag);
  journal.entries = journal.entries.slice(0, last + 1);
  writeFileSync(journalFile, JSON.stringify(journal));
  return folder;
};

describe('account migration', () => {
  const name = `account_migration_${Date.now()}`;
  const server = drizzle({ connection: process.env.DATABASE_URL ?? '' });
  let db: typeof server;
  let folder: string;

  beforeAll(async () => {
    await server.execute(sql.raw(`create database ${name}`));
    const url = new URL(process.env.DATABASE_URL ?? '');
    url.pathname = `/${name}`;
    db = drizzle({ connection: url.toString() });
    folder = migrationsUpTo('0001_bootstrap_administrator');
  });

  afterAll(async () => {
    await db.$client.end();
    await server.execute(sql.raw(`drop database ${name}`));
    await server.$client.end();
    rmSync(folder, { recursive: true, force: true });
  });

  it('moves_password_hashes_into_password_accounts_and_suspension_into_the_status', async () => {
    await migrate(db, { migrationsFolder: folder });
    await db.execute(sql`
      insert into "user" (id, email, name, role, password_hash, suspended)
      values
        (gen_random_uuid(), 'editor@example.com', 'Editor', 'editor', 'hash-1', false),
        (gen_random_uuid(), 'gone@example.com', 'Gone', 'viewer', 'hash-2', true),
        (gen_random_uuid(), 'fresh@example.com', 'Fresh', 'viewer', null, false)
    `);

    await migrate(db, { migrationsFolder: MIGRATIONS });

    const accounts = await db.execute(sql`
      select u.email, a.type, a.identifier, a.config
      from account a join "user" u on u.id = a.user_id
      order by u.email
    `);
    expect(accounts.rows).toEqual([
      {
        email: 'editor@example.com',
        type: 'password',
        identifier: 'editor@example.com',
        config: { passwordHash: 'hash-1' },
      },
      {
        email: 'gone@example.com',
        type: 'password',
        identifier: 'gone@example.com',
        config: { passwordHash: 'hash-2' },
      },
    ]);
    const users = await db.execute(
      sql`select email, status from "user" order by email`,
    );
    expect(users.rows).toEqual([
      { email: 'admin@example.com', status: 'active' },
      { email: 'editor@example.com', status: 'active' },
      { email: 'fresh@example.com', status: 'active' },
      { email: 'gone@example.com', status: 'suspended' },
    ]);
  });
});
