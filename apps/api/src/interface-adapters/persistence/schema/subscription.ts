import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { DeliveryStatus } from '../../../application/automation/subscriptions/enums.js';
import type { JsonObject } from '../../../domain/automation/json.js';
import type { DeliveryEndpoint } from '../../../domain/automation/subscriptions/interfaces.js';
import { user } from './user.js';

// A subscription of its owner's application to the events its filter takes (FR-025).
export const subscription = pgTable(
  'subscription',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    endpoint: jsonb('endpoint').$type<DeliveryEndpoint>().notNull(),
    filter: jsonb('filter').$type<JsonObject>().notNull(),
    types: text('types').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('subscription_owner_idx').on(table.ownerId),
    index('subscription_types_idx').using('gin', table.types),
  ],
);

// One delivery per subscription and event, as its owner reads it (US6 AS6).
export const delivery = pgTable(
  'delivery',
  {
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => subscription.id, { onDelete: 'cascade' }),
    sequence: bigint('sequence', { mode: 'number' }).notNull(),
    eventId: text('event_id').notNull(),
    type: text('type').notNull(),
    status: text('status').$type<DeliveryStatus>().notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    firstAttemptAt: timestamp('first_attempt_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.subscriptionId, table.sequence] }),
    index('delivery_recent_idx').on(table.subscriptionId, table.createdAt),
  ],
);
