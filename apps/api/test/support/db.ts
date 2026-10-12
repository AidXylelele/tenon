import { sql } from 'drizzle-orm';
import type { Database } from '../../src/interface-adapters/interfaces.js';

export async function truncateAll(db: Database): Promise<void> {
  await db.execute(
    sql`truncate table invitation, email_token, session, account, "user" cascade`,
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
