import type { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { DomainEventTopic } from '../enums.js';
import type {
  ProcessDetachedPayload,
  WorkflowDetachedPayload,
} from '../interfaces.js';
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

export type TaskInstanceRow = typeof schema.taskInstance.$inferSelect;

export type EventRow = typeof schema.event.$inferSelect;

export interface OutboxEntry {
  readonly topic: DomainEventTopic;
  readonly key: string;
  readonly payload: ProcessDetachedPayload | WorkflowDetachedPayload;
}
