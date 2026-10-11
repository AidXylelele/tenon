import { drizzle } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import * as schema from '../../interface-adapters/persistence/schema/index.js';

export function createDatabase(pool: pg.Pool) {
  return drizzle({ client: pool, schema, casing: 'snake_case' });
}
