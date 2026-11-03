import {
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { EventOrigin } from '../../../application/automation/events/enums.js';
import type { JsonObject } from '../../../domain/automation/json.js';

// Every CloudEvent the platform accepted or produced, once per source and id (FR-023), in the
// order it was accepted.
export const event = pgTable(
  'event',
  {
    sequence: bigserial('sequence', { mode: 'number' }).primaryKey(),
    source: text('source').notNull(),
    eventId: text('event_id').notNull(),
    type: text('type').notNull(),
    origin: text('origin').$type<EventOrigin>().notNull(),
    instanceId: uuid('instance_id'),
    cloudEvent: jsonb('cloud_event').$type<JsonObject>().notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('event_source_id_idx').on(table.source, table.eventId),
    index('event_instance_idx').on(table.instanceId, table.sequence),
  ],
);
