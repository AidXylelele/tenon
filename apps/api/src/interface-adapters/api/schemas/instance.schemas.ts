import { z } from 'zod';

const Json = z.json();

// The queries' cursors: the last start time in milliseconds and id, or the last position.
const InstanceCursor = z.string().regex(/^\d{1,16}_[0-9a-f-]{36}$/);

const PositionCursor = z.string().regex(/^\d{1,15}$/);

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

export const StartInstanceBody = z.strictObject({
  version: z.string().min(1).optional(),
  input: Json.optional(),
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
