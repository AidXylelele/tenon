import { z } from 'zod';
import { NulCharacter } from '../../../domain/automation/language/nul-character.js';
import { CursorMapper } from '../mappers/cursor.mapper.js';

const Json = z.json();

// The queries' cursors, only as the API gives them out: `CursorMapper` owns their format.
const InstanceCursor = z.string().refine((cursor) => {
  const position = CursorMapper.toInstancePosition(cursor);
  const canonical = CursorMapper.fromInstancePosition(position) === cursor;
  const identified = z.uuid().safeParse(position.id).success;
  return canonical && identified;
});

const PositionCursor = z.string().refine((cursor) => {
  const position = CursorMapper.toPosition(cursor);
  const canonical = CursorMapper.fromPosition(position) === cursor;
  const counted = Number.isSafeInteger(position) && position >= 0;
  return canonical && counted;
});

const AnyJson = z.unknown();

// An RFC 3339 time in a query, read as a Date.
const Instant = z.iso
  .datetime({ offset: true })
  .transform((text) => new Date(text));

const Phase = z.enum([
  'pending',
  'running',
  'waiting',
  'suspended',
  'cancelled',
  'faulted',
  'completed',
]);

// PostgreSQL keeps no U+0000 in jsonb, so an input holding one is refused here.
const StoredJson = Json.refine(
  (value) => !NulCharacter.isIn(value),
  'NUL characters are not allowed',
);

export const StartInstanceBody = z.strictObject({
  version: z.string().min(1).optional(),
  input: StoredJson.optional(),
});

export type StartInstanceBody = z.infer<typeof StartInstanceBody>;

export const InstanceParams = z.strictObject({
  id: z.uuid(),
});

export type InstanceParams = z.infer<typeof InstanceParams>;

export const ListInstancesQuery = z.strictObject({
  namespace: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  phase: Phase.optional(),
  startedFrom: Instant.optional(),
  startedTo: Instant.optional(),
  cursor: InstanceCursor.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListInstancesQuery = z.infer<typeof ListInstancesQuery>;

export const PageQuery = z.strictObject({
  cursor: PositionCursor.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export type PageQuery = z.infer<typeof PageQuery>;

const WorkflowErrorResponse = z.object({
  type: z.string(),
  status: z.number().int(),
  instance: z.string(),
  title: z.string().optional(),
  detail: z.string().optional(),
});

export const InstanceSummaryResponse = z.object({
  id: z.uuid(),
  namespace: z.string(),
  name: z.string(),
  version: z.string(),
  phase: Phase,
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
});

export type InstanceSummaryResponse = z.infer<typeof InstanceSummaryResponse>;

export const InstanceResponse = InstanceSummaryResponse.extend({
  parentId: z.uuid().nullable(),
  input: AnyJson,
  output: AnyJson,
  error: WorkflowErrorResponse.nullable(),
});

export type InstanceResponse = z.infer<typeof InstanceResponse>;

export const InstancePageResponse = z.object({
  items: z.array(InstanceSummaryResponse),
  next: z.string().nullable(),
});

export type InstancePageResponse = z.infer<typeof InstancePageResponse>;

export const TaskRecordResponse = z.object({
  id: z.uuid(),
  reference: z.string(),
  name: z.string(),
  status: z.union([Phase, z.literal('skipped')]),
  parentId: z.uuid().nullable(),
  input: AnyJson,
  output: AnyJson,
  error: WorkflowErrorResponse.nullable(),
  retries: z.number().int(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
});

export type TaskRecordResponse = z.infer<typeof TaskRecordResponse>;

export const TaskRecordPageResponse = z.object({
  items: z.array(TaskRecordResponse),
  next: z.string().nullable(),
});

export type TaskRecordPageResponse = z.infer<typeof TaskRecordPageResponse>;

export const CloudEventResponse = z.looseObject({
  specversion: z.literal('1.0'),
  id: z.string(),
  source: z.string(),
  type: z.string(),
  time: z.iso.datetime(),
});

export type CloudEventResponse = z.infer<typeof CloudEventResponse>;

export const CloudEventPageResponse = z.object({
  items: z.array(CloudEventResponse),
  next: z.string().nullable(),
});

export type CloudEventPageResponse = z.infer<typeof CloudEventPageResponse>;
