import { z } from 'zod';

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
  on: z.boolean(),
  currentVersion: z.string().nullable(),
});

export type WorkflowResponse = z.infer<typeof WorkflowResponse>;

export const WorkflowPageResponse = z.object({
  items: z.array(WorkflowResponse),
  next: z.string().nullable(),
});

export type WorkflowPageResponse = z.infer<typeof WorkflowPageResponse>;

export const ListWorkflowsQuery = z.strictObject({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListWorkflowsQuery = z.infer<typeof ListWorkflowsQuery>;

export const ConformanceResponse = z.object({
  dsl: z.array(z.string()),
  tasks: z.array(z.string()),
  calls: z.array(z.string()),
  runs: z.array(z.string()),
  scriptLanguages: z.array(z.string()),
  authentications: z.array(z.string()),
  excluded: z.array(z.string()),
  contradictions: z.array(z.string()),
});

export type ConformanceResponse = z.infer<typeof ConformanceResponse>;

const DSL_NAME = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

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
