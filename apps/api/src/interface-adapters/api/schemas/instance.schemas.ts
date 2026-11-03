import { z } from 'zod';
import { TaskStatus } from '../../../application/automation/instances/enums.js';
import {
  Phase,
  TriggerKind,
} from '../../../domain/automation/instances/enums.js';
import { CursorMapper } from '../mappers/cursor.mapper.js';

// A JSON value as the API answers it.
export const ResponseJson = z.json();

export type ResponseJson = z.infer<typeof ResponseJson>;

export const StartInstanceBody = z.strictObject({
  input: z.json().default({}),
  version: z.string().optional(),
});

export type StartInstanceBody = z.infer<typeof StartInstanceBody>;

export const InstanceParams = z.strictObject({ id: z.uuid() });

export type InstanceParams = z.infer<typeof InstanceParams>;

const InstanceCursor = z.string().refine((cursor) => {
  const position = CursorMapper.toInstancePosition(cursor);
  const valid =
    !Number.isNaN(position.createdAt.getTime()) &&
    z.uuid().safeParse(position.id).success;
  return valid && CursorMapper.fromInstancePosition(position) === cursor;
});

export const ListInstancesQuery = z.strictObject({
  namespace: z.string().optional(),
  name: z.string().optional(),
  phase: z.enum(Phase).optional(),
  cursor: InstanceCursor.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListInstancesQuery = z.infer<typeof ListInstancesQuery>;

export const TasksQuery = z.strictObject({
  cursor: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export type TasksQuery = z.infer<typeof TasksQuery>;

export const InstanceSummaryResponse = z.object({
  id: z.uuid(),
  namespace: z.string(),
  name: z.string(),
  version: z.string(),
  phase: z.enum(Phase),
  trigger: z.enum(TriggerKind),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  endedAt: z.iso.datetime().nullable(),
});

export type InstanceSummaryResponse = z.infer<typeof InstanceSummaryResponse>;

export const InstanceResponse = InstanceSummaryResponse.extend({
  input: z.json(),
  output: z.json().nullable(),
  error: z.json().nullable(),
  originId: z.uuid().nullable(),
  starterId: z.uuid().nullable(),
});

export type InstanceResponse = z.infer<typeof InstanceResponse>;

export const InstancePageResponse = z.object({
  items: z.array(InstanceSummaryResponse),
  next: z.string().nullable(),
});

export type InstancePageResponse = z.infer<typeof InstancePageResponse>;

export const TaskRecordResponse = z.object({
  execution: z.string(),
  reference: z.string(),
  name: z.string(),
  status: z.enum(TaskStatus),
  input: z.json(),
  output: z.json(),
  error: z.json().nullable(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
});

export const TaskPageResponse = z.object({
  items: z.array(TaskRecordResponse),
  next: z.string().nullable(),
});

export type TaskPageResponse = z.infer<typeof TaskPageResponse>;

export const EventPageResponse = z.object({
  items: z.array(ResponseJson),
  next: z.string().nullable(),
});

export type EventPageResponse = z.infer<typeof EventPageResponse>;
