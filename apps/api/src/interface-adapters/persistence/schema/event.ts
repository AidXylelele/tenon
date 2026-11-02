import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { EventOriginKind } from '../../../domain/automation/events/enums.js';
import type {
  JsonObject,
  JsonValue,
} from '../../../domain/automation/language/interfaces.js';

export const event = pgTable(
  'event',
  {
    id: uuid('id').primaryKey(),
    source: text('source').notNull(),
    eventId: text('event_id').notNull(),
    type: text('type').notNull(),
    time: timestamp('time', { withTimezone: true }).notNull(),
    subject: text('subject'),
    dataContentType: text('data_content_type'),
    dataSchema: text('data_schema'),
    data: jsonb('data').$type<JsonValue>(),
    extensions: jsonb('extensions').$type<JsonObject>().notNull(),
    originKind: text('origin_kind').$type<EventOriginKind>().notNull(),
    originWorkflowId: uuid('origin_workflow_id'),
    originInstanceId: uuid('origin_instance_id'),
    sequence: integer('sequence'),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('event_source_event_id_idx').on(table.source, table.eventId),
    index('event_origin_instance_sequence_idx').on(
      table.originInstanceId,
      table.sequence,
    ),
  ],
);
