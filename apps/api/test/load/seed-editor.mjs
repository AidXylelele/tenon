// Creates (or keeps) the editor the k6 scripts sign in as, with a password account hashed by the
// app's own scrypt PasswordHasher. Run from apps/api with DATABASE_URL set:
//   node test/load/seed-editor.mjs [email] [password]
import { randomUUID } from 'node:crypto';
import { PasswordHasher } from '@nestjs/authentication';
import pg from 'pg';

const email = process.argv[2] ?? 'load-editor@example.com';
const password = process.argv[3] ?? 'load-test-password-123';
const url = process.env.DATABASE_URL;

if (url === undefined || url === '') {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const found = await client.query('select id from "user" where email = $1', [
    email,
  ]);

  if (found.rowCount === 0) {
    const userId = randomUUID();
    const now = new Date();
    const hash = await new PasswordHasher().hash(password);
    await client.query('begin');
    await client.query(
      `insert into "user" (id, email, name, role, status, created_at)
       values ($1, $2, 'Load editor', 'editor', 'active', $3)`,
      [userId, email, now],
    );
    await client.query(
      `insert into account (id, user_id, type, identifier, config, created_at, updated_at, version)
       values ($1, $2, 'password', $3, $4, $5, $5, 1)`,
      [randomUUID(), userId, email, { passwordHash: hash }, now],
    );
    await client.query('commit');
    console.log(`created editor ${email}`);
  } else {
    console.log(`editor ${email} exists`);
  }
} finally {
  await client.end();
}
