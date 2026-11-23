import type { InterpreterOptions } from "../api/index.js";

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

const standardNamespace = "org.open-workflow-specification";

const legacyNamespace = "io.serverlessworkflow";

interface LifecycleEventEntry {
  readonly at: string;
  readonly once: boolean;
  readonly ending: boolean;
}

export type LifecycleEventTypes = Readonly<
  Record<LifecycleEventName, readonly string[]>
>;

export const lifecycleEventCatalogue: Readonly<
  Record<LifecycleEventName, LifecycleEventEntry>
> = catalogueOf(lifecycleEvents);

const standardTypes = typesOf([standardNamespace]);

const standardAndLegacyTypes = typesOf([standardNamespace, legacyNamespace]);

export function lifecycleEventTypesOf(
  options: InterpreterOptions,
): LifecycleEventTypes {
  return options.legacyEventTypes === true
    ? standardAndLegacyTypes
    : standardTypes;
}

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
  const built: LifecycleEventEntry = {
    at: event.at,
    once: event.once,
    ending: event.ending,
  };
  const entry = Object.freeze(built);

  return [event.name, entry];
}

function typesOf(namespaces: readonly string[]): LifecycleEventTypes {
  const entries = lifecycleEvents.map((event) =>
    typedEntryOf(event.name, namespaces),
  );

  const typed = Object.fromEntries(entries) as Record<
    LifecycleEventName,
    readonly string[]
  >;

  return Object.freeze(typed);
}

function typedEntryOf(
  name: LifecycleEventName,
  namespaces: readonly string[],
): readonly [LifecycleEventName, readonly string[]] {
  const named = namespaces.map((namespace) => `${namespace}.${name}.v1`);
  const types = Object.freeze(named);

  return [name, types];
}
