import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  PasswordHasher,
  UserRepository,
} from '../../src/application/interfaces.js';
import type { RoleName } from '../../src/domain/interfaces.js';
import { User } from '../../src/domain/user.js';
import type { Database } from '../../src/interface-adapters/interfaces.js';
import {
  session,
  user as users,
} from '../../src/interface-adapters/persistence/schema/index.js';
import { PASSWORD } from './builders.js';
import type { TestApp } from './create-test-app.js';

export { PASSWORD };

export const SEED_ADMIN_EMAIL = 'admin@example.com';

export async function createUser(
  t: TestApp,
  input: {
    email: string;
    password?: string;
    role?: RoleName;
    name?: string;
  },
): Promise<User> {
  const passwordHash = await t.app
    .get(PasswordHasher)
    .hash(input.password ?? PASSWORD);
  const user = User.create({
    email: input.email,
    name: input.name ?? input.email.split('@')[0] ?? 'user',
    role: input.role ?? 'viewer',
    passwordHash,
  });
  await t.app.get(UserRepository).add(user);
  return user;
}

export async function signIn(
  server: App,
  email: string,
  password = PASSWORD,
): Promise<string> {
  const response = await request(server)
    .post('/api/v1/auth/session')
    .send({ email, password })
    .expect(200);
  return cookieHeader(response.headers['set-cookie']);
}

export const cookieHeader = (
  setCookie: string | string[] | undefined,
): string => {
  const list = Array.isArray(setCookie)
    ? setCookie
    : setCookie
      ? [setCookie]
      : [];
  return list.map((cookie) => cookie.split(';')[0]).join('; ');
};

export const authHeaders = (cookie: string): Record<string, string> => ({
  cookie,
});

export async function expireSession(
  db: Database,
  cookie: string,
): Promise<void> {
  const token =
    cookie
      .split('; ')
      .find((part) => part.startsWith('sid='))
      ?.slice('sid='.length) ?? '';
  await db
    .update(session)
    .set({ expiresAt: new Date(Date.now() - 60_000) })
    .where(
      eq(session.id, createHash('sha256').update(token).digest('base64url')),
    );
}

export async function suspendUser(db: Database, userId: string): Promise<void> {
  await db.update(users).set({ suspended: true }).where(eq(users.id, userId));
}

export async function seedAdministrator(db: Database): Promise<void> {
  const file = fileURLToPath(
    new URL('../../drizzle/0001_bootstrap_administrator.sql', import.meta.url),
  );
  await db.execute(sql.raw(readFileSync(file, 'utf8')));
}
