import type { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema/index.js';

export interface KeysetSlice<R, P> {
  readonly items: readonly R[];
  readonly next: P | null;
}

export abstract class Database extends NodePgDatabase<typeof schema> {}

export type DrizzleTx = TransactionalAdapterDrizzleOrm<Database>;

export type UserRow = typeof schema.user.$inferSelect;

export type AccountRow = typeof schema.account.$inferSelect;

export type InvitationRow = typeof schema.invitation.$inferSelect;

export type WorkflowRow = typeof schema.workflow.$inferSelect;

export type WorkflowVersionRow = typeof schema.workflowVersion.$inferSelect;

export type WorkflowInstanceRow = typeof schema.workflowInstance.$inferSelect;

export type WebhookRow = typeof schema.webhook.$inferSelect;

export type SecretRow = typeof schema.secret.$inferSelect;

// Seals a secret's value before it is stored and opens it when it is read: values are
// encrypted at rest (FR-007).
export abstract class Cipher {
  abstract seal(value: string): string;
  abstract open(sealed: string): string;
}
