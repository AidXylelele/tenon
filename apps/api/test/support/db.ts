import { sql } from 'drizzle-orm';
import type { Database } from '../../src/interface-adapters/interfaces.js';

export async function truncateAll(db: Database): Promise<void> {
  await db.execute(
    sql`truncate table idempotency_key, webhook_endpoint, node_sample, step, run, release, workflow, invitation, email_token, session, account, "user" cascade`,
  );
  await db.execute(
    sql`truncate table nest_workflows.instances, nest_workflows.journal, nest_workflows.signals, nest_workflows.waits, nest_workflows.rate_limits cascade`,
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
