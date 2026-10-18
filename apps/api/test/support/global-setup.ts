import { fileURLToPath } from 'node:url';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { TestProject } from 'vitest/node';
import { startObjectStorage, type ObjectStorage } from './object-storage.js';

declare module 'vitest' {
  export interface ProvidedContext {
    DATABASE_URL: string;
    STORAGE_ENDPOINT: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;
let storage: ObjectStorage | undefined;

export async function setup(project: TestProject): Promise<void> {
  const [postgres, objects] = await Promise.all([
    new PostgreSqlContainer('postgres:18.6-alpine3.24').start(),
    startObjectStorage(),
  ]);
  container = postgres;
  storage = objects;
  const url = container.getConnectionUri();
  const db = drizzle({ connection: url });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
  });
  await db.$client.end();
  project.provide('DATABASE_URL', url);
  project.provide('STORAGE_ENDPOINT', storage.endpoint);
}

export async function teardown(): Promise<void> {
  await Promise.all([container?.stop(), storage?.stop()]);
}
