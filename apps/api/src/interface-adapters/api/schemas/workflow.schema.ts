import { z } from "zod";
import { Phase } from "../../../domain/automation/instances/enums.js";
import {
  ScheduleKind,
  WorkflowStatus,
} from "../../../domain/automation/workflows/enums.js";
import { Instant } from "./instance.schema.js";

export const DefinitionBody = z.record(z.string(), z.json());

export type DefinitionBody = z.infer<typeof DefinitionBody>;

export const DefinitionProblemsResponse = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  errors: z.array(
    z.object({
      code: z.string(),
      pointer: z.string(),
      detail: z.string(),
      line: z.number().int().nullable(),
      column: z.number().int().nullable(),
    }),
  ),
});

const PersonResponse = z.object({ id: z.uuid(), name: z.string() });

const ScheduleResponse = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal(ScheduleKind.Every), interval: z.number() }),
  z.object({ kind: z.literal(ScheduleKind.Cron), cron: z.string() }),
  z.object({ kind: z.literal(ScheduleKind.After), delay: z.number() }),
  z.object({
    kind: z.literal(ScheduleKind.On),
    types: z.array(z.string()),
  }),
]);

const LastRunResponse = z.object({
  id: z.uuid(),
  phase: z.enum(Phase),
  createdAt: z.iso.datetime(),
});

export const VersionResponse = z.object({
  namespace: z.string(),
  name: z.string(),
  version: z.string(),
  dsl: z.string(),
  current: z.boolean(),
  publishedBy: PersonResponse,
  publishedAt: z.iso.datetime(),
});

export type VersionResponse = z.infer<typeof VersionResponse>;

export const VersionListResponse = z.array(VersionResponse);

export type VersionListResponse = z.infer<typeof VersionListResponse>;

export const VersionSourceResponse = z.object({
  source: z.string().nullable(),
});

export type VersionSourceResponse = z.infer<typeof VersionSourceResponse>;

export const WorkflowResponse = z.object({
  namespace: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  status: z.enum(WorkflowStatus),
  on: z.boolean(),
  currentVersion: z.string().nullable(),
  schedule: ScheduleResponse.nullable(),
  starts: z.number().int(),
  lastRun: LastRunResponse.nullable(),
});

export type WorkflowResponse = z.infer<typeof WorkflowResponse>;

const Segment = z.string().min(1).max(255);

const NAME_SEPARATOR = "\n";

const CURSOR_ENCODING = "base64url";

const WorkflowPosition = z.object({
  namespace: Segment,
  name: Segment,
});

export const WorkflowCursor = z.codec(z.base64url(), WorkflowPosition, {
  decode: (cursor) => {
    const named = Buffer.from(cursor, CURSOR_ENCODING).toString();
    const [namespace = "", name = ""] = named.split(NAME_SEPARATOR);
    return { namespace, name };
  },
  encode: (position) => {
    const named = `${position.namespace}${NAME_SEPARATOR}${position.name}`;
    return Buffer.from(named).toString(CURSOR_ENCODING);
  },
});

export const WorkflowPageResponse = z.object({
  items: z.array(WorkflowResponse),
  next: z.string().nullable(),
});

export type WorkflowPageResponse = z.infer<typeof WorkflowPageResponse>;

export const ListWorkflowsQuery = z.strictObject({
  cursor: WorkflowCursor.optional(),
  status: z.enum(WorkflowStatus).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListWorkflowsQuery = z.infer<typeof ListWorkflowsQuery>;

export const WorkflowParams = z.strictObject({
  namespace: Segment,
  name: Segment,
});

export type WorkflowParams = z.infer<typeof WorkflowParams>;

export const VersionParams = z.strictObject({
  namespace: Segment,
  name: Segment,
  version: Segment,
});

export type VersionParams = z.infer<typeof VersionParams>;

export const ExpectedStartsQuery = z.strictObject({ from: Instant });

export type ExpectedStartsQuery = z.infer<typeof ExpectedStartsQuery>;

export const ExpectedStartsResponse = z.array(
  z.object({
    namespace: z.string(),
    name: z.string(),
    schedule: ScheduleResponse.nullable(),
    next: z.array(z.iso.datetime()),
    missed: z.number().int(),
    missedSince: z.iso.datetime(),
  }),
);

export type ExpectedStartsResponse = z.infer<typeof ExpectedStartsResponse>;
