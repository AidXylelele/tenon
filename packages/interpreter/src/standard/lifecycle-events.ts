const lifecycleEvents = [
  {
    name: "workflow.started",
    subject: "workflow",
    at: "startedAt",
    once: true,
    ending: false,
  },
  {
    name: "workflow.suspended",
    subject: "workflow",
    at: "suspendedAt",
    once: false,
    ending: false,
  },
  {
    name: "workflow.resumed",
    subject: "workflow",
    at: "resumedAt",
    once: false,
    ending: false,
  },
  {
    name: "workflow.correlation-started",
    subject: "workflow",
    at: "startedAt",
    once: true,
    ending: false,
  },
  {
    name: "workflow.correlation-completed",
    subject: "workflow",
    at: "completedAt",
    once: true,
    ending: false,
  },
  {
    name: "workflow.cancelled",
    subject: "workflow",
    at: "cancelledAt",
    once: true,
    ending: true,
  },
  {
    name: "workflow.faulted",
    subject: "workflow",
    at: "faultedAt",
    once: true,
    ending: true,
  },
  {
    name: "workflow.completed",
    subject: "workflow",
    at: "completedAt",
    once: true,
    ending: true,
  },
  {
    name: "task.created",
    subject: "task",
    at: "createdAt",
    once: false,
    ending: false,
  },
  {
    name: "task.started",
    subject: "task",
    at: "startedAt",
    once: false,
    ending: false,
  },
  {
    name: "task.suspended",
    subject: "task",
    at: "suspendedAt",
    once: false,
    ending: false,
  },
  {
    name: "task.resumed",
    subject: "task",
    at: "resumedAt",
    once: false,
    ending: false,
  },
  {
    name: "task.retried",
    subject: "task",
    at: "retriedAt",
    once: false,
    ending: false,
  },
  {
    name: "task.cancelled",
    subject: "task",
    at: "cancelledAt",
    once: false,
    ending: true,
  },
  {
    name: "task.faulted",
    subject: "task",
    at: "faultedAt",
    once: false,
    ending: true,
  },
  {
    name: "task.completed",
    subject: "task",
    at: "completedAt",
    once: false,
    ending: true,
  },
] as const;
export type LifecycleEventName = (typeof lifecycleEvents)[number]["name"];

export type WorkflowEventName = Extract<
  (typeof lifecycleEvents)[number],
  { readonly subject: "workflow" }
>["name"];

export type TaskEventName = Extract<
  (typeof lifecycleEvents)[number],
  { readonly subject: "task" }
>["name"];

const lifecycleEventNamespaces = [
  "org.open-workflow-specification",
  "io.serverlessworkflow",
] as const;

function lifecycleEventTypesOf(name: LifecycleEventName): readonly string[] {
  return lifecycleEventNamespaces.map((namespace) => `${namespace}.${name}.v1`);
}

interface LifecycleEventEntry {
  readonly at: string;
  readonly once: boolean;
  readonly ending: boolean;
  readonly types: readonly string[];
}

export const lifecycleEventCatalogue: Readonly<
  Record<LifecycleEventName, LifecycleEventEntry>
> = catalogueOf(lifecycleEvents);

function catalogueOf(
  events: typeof lifecycleEvents,
): Readonly<Record<LifecycleEventName, LifecycleEventEntry>> {
  const entries = events.map(entryOf);

  const catalogue = Object.fromEntries(entries) as Record<
    LifecycleEventName,
    LifecycleEventEntry
  >;

  return Object.freeze(catalogue);
}

function entryOf(
  event: (typeof lifecycleEvents)[number],
): readonly [LifecycleEventName, LifecycleEventEntry] {
  const named = lifecycleEventTypesOf(event.name);
  const types = Object.freeze(named);
  const built: LifecycleEventEntry = {
    at: event.at,
    once: event.once,
    ending: event.ending,
    types,
  };
  const entry = Object.freeze(built);

  return [event.name, entry];
}
