import { z } from "zod";
import { TaskStatus } from "../../../application/automation/instances/enums.js";
import {
  Control,
  Phase,
  TriggerKind,
  WaitKind,
} from "../../../domain/automation/instances/enums.js";

export const ResponseJson = z.json();

export type ResponseJson = z.infer<typeof ResponseJson>;

export const LATEST = "latest";

export const StartInstanceBody = z.strictObject({
  input: z.json().default({}),
  version: z.string().min(1).default(LATEST),
});

export type StartInstanceBody = z.infer<typeof StartInstanceBody>;

export const StartFingerprint = StartInstanceBody.or(z.unknown());

export const InstanceParams = z.strictObject({ id: z.uuid() });

export type InstanceParams = z.infer<typeof InstanceParams>;

export const TaskOutputParams = z.strictObject({
  id: z.uuid(),
  execution: z.string().min(1),
});

export type TaskOutputParams = z.infer<typeof TaskOutputParams>;

const INSTANCE_CURSOR = /^\d+_[^_]+$/;

const CURSOR_SEPARATOR = "_";

const InstancePosition = z.object({ createdAt: z.date(), id: z.uuid() });

export const InstanceCursor = z.codec(
  z.string().regex(INSTANCE_CURSOR),
  InstancePosition,
  {
    decode: (cursor) => {
      const [epoch = "", id = ""] = cursor.split(CURSOR_SEPARATOR);
      const milliseconds = Number(epoch);
      const createdAt = new Date(milliseconds);
      return { createdAt, id };
    },
    encode: (position) => {
      const epoch = position.createdAt.getTime();
      const milliseconds = String(epoch);
      return `${milliseconds}${CURSOR_SEPARATOR}${position.id}`;
    },
  },
);

export const ListInstancesQuery = z.strictObject({
  namespace: z.string().optional(),
  name: z.string().optional(),
  version: z.string().min(1).optional(),
  phase: z.enum(Phase).optional(),
  startedFrom: z.iso.datetime({ offset: true }).optional(),
  startedTo: z.iso.datetime({ offset: true }).optional(),
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
  startedBy: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  controls: z.array(z.enum(Control)),
  cancelReason: z.string().nullable(),
  waits: z.array(
    z.object({
      kind: z.enum(WaitKind),
      until: z.iso.datetime().nullable(),
      stream: z.string().nullable(),
      instanceId: z.uuid().nullable(),
    }),
  ),
});

export type InstanceResponse = z.infer<typeof InstanceResponse>;

export const InstancePageResponse = z.object({
  items: z.array(InstanceSummaryResponse),
  next: z.string().nullable(),
});

export type InstancePageResponse = z.infer<typeof InstancePageResponse>;

const TaskRecordResponse = z.object({
  execution: z.string(),
  reference: z.string(),
  name: z.string(),
  status: z.enum(TaskStatus),
  error: z.json().nullable(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  attempt: z.number().int().min(1),
  input: z.json().nullable(),
  output: z.json().nullable(),
  retryAt: z.iso.datetime().nullable(),
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

export const InstanceCountsQuery = z
  .strictObject({ from: z.iso.datetime(), to: z.iso.datetime() })
  .refine(
    (window) => {
      const from = Date.parse(window.from);
      const to = Date.parse(window.to);
      return from < to;
    },
    { message: "from is before to", path: ["to"] },
  );

export type InstanceCountsQuery = z.infer<typeof InstanceCountsQuery>;

export const InstanceCountsResponse = z.object({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  counts: z.record(z.enum(Phase), z.number().int()),
});

export type InstanceCountsResponse = z.infer<typeof InstanceCountsResponse>;
