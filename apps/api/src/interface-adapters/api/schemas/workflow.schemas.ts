import { z } from 'zod';
import { WorkflowStatus } from '../../../domain/automation/workflows/enums.js';
import { CursorMapper } from '../mappers/cursor.mapper.js';

// The DSL document itself; the runtime validates it against the standard's schema.
export const DefinitionBody = z.record(z.string(), z.json());

export type DefinitionBody = z.infer<typeof DefinitionBody>;

export const VersionResponse = z.object({
  namespace: z.string(),
  name: z.string(),
  version: z.string(),
  dsl: z.string(),
  current: z.boolean(),
  publishedBy: z.uuid(),
  publishedAt: z.iso.datetime(),
});

export type VersionResponse = z.infer<typeof VersionResponse>;

export const WorkflowResponse = z.object({
  namespace: z.string(),
  name: z.string(),
  status: z.enum(WorkflowStatus),
  on: z.boolean(),
  currentVersion: z.string().nullable(),
});

export type WorkflowResponse = z.infer<typeof WorkflowResponse>;

const DSL_NAME = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

// The list's cursor, only as the API gives it out: the last workflow's two labels.
const WorkflowCursor = z.base64url().refine((cursor) => {
  const position = CursorMapper.toWorkflowPosition(cursor);
  const canonical = CursorMapper.fromWorkflowPosition(position) === cursor;
  const labelled =
    DSL_NAME.test(position.namespace) && DSL_NAME.test(position.name);
  return canonical && labelled;
});

export const WorkflowPageResponse = z.object({
  items: z.array(WorkflowResponse),
  next: z.string().nullable(),
});

export type WorkflowPageResponse = z.infer<typeof WorkflowPageResponse>;

export const ListWorkflowsQuery = z.strictObject({
  cursor: WorkflowCursor.optional(),
  status: z.enum(WorkflowStatus).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListWorkflowsQuery = z.infer<typeof ListWorkflowsQuery>;

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

export const WorkflowParams = z.strictObject({
  namespace: z.string().regex(DSL_NAME),
  name: z.string().regex(DSL_NAME),
});

export type WorkflowParams = z.infer<typeof WorkflowParams>;

export const VersionParams = z.strictObject({
  namespace: z.string().regex(DSL_NAME),
  name: z.string().regex(DSL_NAME),
  version: z.string().regex(SEMVER),
});

export type VersionParams = z.infer<typeof VersionParams>;
