import { z } from "zod";
import {
  InstanceOrder,
  TaskStatus,
} from "../../../application/automation/instances/enums.js";
import { InstanceQueries } from "../../../application/automation/instances/queries.js";
import {
  Control,
  Phase,
  TriggerKind,
  WaitKind,
} from "../../../domain/automation/instances/enums.js";
import { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";

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

export const TasksQuery = z.strictObject({
  cursor: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export type TasksQuery = z.infer<typeof TasksQuery>;

export const InputProblemsResponse = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    errors: z.array(z.object({ pointer: z.string(), detail: z.string() })),
  })
  .meta({ id: "InputProblemsResponse" });

export const InstanceSummaryResponse = z.object({
  id: z.uuid(),
  namespace: z.string(),
  name: z.string(),
  version: z.string(),
  phase: z.enum(Phase),
  trigger: z.enum(TriggerKind),
  test: z.boolean(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  endedAt: z.iso.datetime().nullable(),
});

export type InstanceSummaryResponse = z.infer<typeof InstanceSummaryResponse>;

const StarterResponse = z.object({ id: z.uuid(), name: z.string() });

export const InstanceResponse = InstanceSummaryResponse.extend({
  input: z.json(),
  output: z.json().nullable(),
  error: z.json().nullable(),
  originId: z.uuid().nullable(),
  startedBy: StarterResponse.nullable(),
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

const ListedInstanceResponse = InstanceSummaryResponse.extend({
  startedBy: StarterResponse.nullable(),
  durationMs: z.number().int().nullable(),
  waits: z.array(
    z.object({
      kind: z.enum(WaitKind),
      until: z.iso.datetime().nullable(),
      stream: z.string().nullable(),
    }),
  ),
});

export const InstancePageResponse = z.object({
  items: z.array(ListedInstanceResponse),
  total: z.number().int(),
  exact: z.boolean(),
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

export const Instant = z.codec(z.iso.datetime({ offset: true }), z.date(), {
  decode: (text) => new Date(text),
  encode: (date) => date.toISOString(),
});

const MOST_BUCKETS = 100;

const LONGEST_SPAN = 92 * 24 * 60 * 60 * 1_000;

function spans(from: Date, to: Date): boolean {
  const span = to.getTime() - from.getTime();
  return span <= LONGEST_SPAN;
}

const Buckets = z
  .union([Instant, z.array(Instant).min(1).max(MOST_BUCKETS)])
  .transform((value) => [value].flat());

const Included = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const Phases = z
  .union([z.enum(Phase), z.array(z.enum(Phase))])
  .transform((value) => [value].flat());

export const ListInstancesQuery = z
  .strictObject({
    namespace: z.string().optional(),
    name: z.string().optional(),
    version: z.string().min(1).optional(),
    phase: Phases.optional(),
    from: Instant.optional(),
    to: Instant.optional(),
    tests: Included.default(false),
    sort: z.enum(InstanceOrder).default(InstanceOrder.Started),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine(
    (query) => {
      const skipped = (query.page - 1) * query.limit;
      return skipped < InstanceQueries.MOST_COUNTED;
    },
    { message: "the page starts beyond the counted runs", path: ["page"] },
  );

export type ListInstancesQuery = z.infer<typeof ListInstancesQuery>;

export const InstanceCountsQuery = z
  .strictObject({
    bucket: Buckets,
    to: Instant,
    previousFrom: Instant.optional(),
    namespace: z.string().optional(),
    name: z.string().optional(),
    tests: Included.default(false),
  })
  .refine(
    (window) =>
      window.bucket.every((start, index) => {
        const next = window.bucket[index + 1] ?? window.to;
        return start < next;
      }),
    { message: "the buckets ascend and end before to", path: ["bucket"] },
  )
  .refine(
    (window) => {
      const first = window.bucket[0] ?? window.to;
      return window.previousFrom === undefined || window.previousFrom < first;
    },
    {
      message: "the previous window ends at the first bucket",
      path: ["previousFrom"],
    },
  )
  .refine(
    (window) => {
      const first = window.bucket[0] ?? window.to;
      const from = window.previousFrom ?? first;
      return spans(from, window.to);
    },
    { message: "the counts span at most 92 days", path: ["previousFrom"] },
  );

export type InstanceCountsQuery = z.infer<typeof InstanceCountsQuery>;

const PhaseCounts = z.record(z.enum(Phase), z.number().int());

export type PhaseCounts = z.infer<typeof PhaseCounts>;

const LivePhases = WorkflowInstance.livePhases();

const LiveCounts = z.record(z.enum(LivePhases), z.number().int());

export const InstanceCountsResponse = z.object({
  to: z.iso.datetime(),
  buckets: z.array(z.object({ start: z.iso.datetime(), counts: PhaseCounts })),
  total: PhaseCounts,
  previous: z
    .object({ from: z.iso.datetime(), counts: PhaseCounts })
    .nullable(),
  now: LiveCounts,
});

export type InstanceCountsResponse = z.infer<typeof InstanceCountsResponse>;

const MOST_FAILING = 100;

const FEW_FAILING = 5;

export const FailingWorkflowsQuery = z
  .strictObject({
    from: Instant,
    to: Instant,
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MOST_FAILING)
      .default(FEW_FAILING),
    tests: Included.default(false),
  })
  .refine((window) => window.from < window.to, {
    message: "from is before to",
    path: ["to"],
  })
  .refine((window) => spans(window.from, window.to), {
    message: "the window spans at most 92 days",
    path: ["from"],
  });

export type FailingWorkflowsQuery = z.infer<typeof FailingWorkflowsQuery>;

export const FailingWorkflowsResponse = z.object({
  items: z.array(
    z.object({
      namespace: z.string(),
      name: z.string(),
      failed: z.number().int(),
      runs: z.number().int(),
      firstFailedAt: z.iso.datetime(),
      lastFailedAt: z.iso.datetime(),
      lastError: z.object({
        status: z.number().int().nullable(),
        type: z.string().nullable(),
        title: z.string().nullable(),
        detail: z.string().nullable(),
      }),
      stillFailing: z.boolean(),
    }),
  ),
  workflows: z.number().int(),
  failed: z.number().int(),
});

export type FailingWorkflowsResponse = z.infer<typeof FailingWorkflowsResponse>;
