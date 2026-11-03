import type { INestApplication } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { sql } from 'drizzle-orm';
import type { Database } from '../../src/interface-adapters/persistence/interfaces.js';

export async function truncateAll(db: Database): Promise<void> {
  await db.execute(
    sql`truncate table event, listener, task_progress, workflow_instance, workflow_version, workflow, idempotency_key, invitation, email_token, session, account, "user" cascade`,
  );
  await db.execute(
    sql`truncate table nest_outbox.messages, nest_outbox.inbox, nest_outbox.dead_letters`,
  );
}

export async function queuedMailCount(db: Database): Promise<number> {
  const result = await db.execute(
    sql`select count(*)::int as count from nest_outbox.messages`,
  );
  const [row] = result.rows as { count: number }[];
  return row?.count ?? 0;
}

export function inTransaction<T>(
  app: INestApplication,
  work: () => Promise<T>,
): Promise<T> {
  return app.get(TransactionHost).withTransaction(work);
}
