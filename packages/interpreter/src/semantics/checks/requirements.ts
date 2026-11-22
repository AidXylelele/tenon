import type { EffectKind, HostProfile } from "../../api/index.js";
import type {
  AsyncApiCall,
  AuthenticationPolicy,
  Call,
  ExternalSchema,
  FunctionCall,
  Process,
  Reference,
  RetryPolicy,
  Schedule,
  Schema,
  Task,
  Workflow,
} from "../../syntax/index.js";
import type {
  Context,
  Occurrence,
  ReferenceOccurrence,
  RetryReferenceOccurrence,
} from "../occurrences/index.js";
import type { ReferenceTable } from "../symbols/index.js";
import { importedUriOf } from "../uris/index.js";
import { grantOf, policyOf, schemeOf } from "./policies.js";

export const offers = {
  effect: "effects",
  authentication: "authentications",
  grant: "grants",
  process: "processes",
  script: "scriptLanguages",
  asyncapi: "asyncApiProtocols",
  mcp: "mcpTransports",
  mcpOption: "mcpTransportOptions",
  schedule: "schedules",
} as const satisfies Readonly<Record<string, keyof HostProfile>>;

type Offers = typeof offers;

export type Requirement = {
  readonly [Kind in keyof Offers]: {
    readonly kind: Kind;
    readonly name: NonNullable<HostProfile[Offers[Kind]]>[number];
    readonly pointer: string;
  };
}[keyof Offers];

const none: readonly Requirement[] = [];

const noCallees: readonly string[] = [];

const workflowItself: ReadonlySet<string | null> = new Set([null]);

export function requirementsOf(
  workflow: Workflow,
  occurrences: readonly Occurrence[],
  references: ReferenceTable,
): readonly Requirement[] {
  const reachable = reachableOf(occurrences, references);
  const scheduled = workflow.schedules.flatMap(scheduleRequirementsOf);
  const needed = reachable.flatMap((occurrence) =>
    occurrenceRequirementsOf(occurrence, references),
  );

  return [...scheduled, ...needed];
}

function reachableOf(
  occurrences: readonly Occurrence[],
  references: ReferenceTable,
): readonly Occurrence[] {
  const reached = reachedOf(occurrences, workflowItself, references);
  return occurrences.filter(({ context }) => reached.has(context.function));
}

function reachedOf(
  occurrences: readonly Occurrence[],
  reached: ReadonlySet<string | null>,
  references: ReferenceTable,
): ReadonlySet<string | null> {
  const callees = occurrences
    .filter((occurrence) => occurrence.kind === "call")
    .filter(({ context }) => reached.has(context.function))
    .flatMap(({ call }) => calleesOf(call, references));
  const fresh = callees.filter((name) => !reached.has(name));

  if (fresh.length === 0) {
    return reached;
  }

  const names = [...reached, ...fresh];
  const more = new Set(names);
  return reachedOf(occurrences, more, references);
}

function calleesOf(
  call: FunctionCall,
  references: ReferenceTable,
): readonly string[] {
  const callee = references.functions.get(call.function.pointer);

  if (callee === undefined) {
    return noCallees;
  }

  return [callee.name];
}

function occurrenceRequirementsOf(
  occurrence: Occurrence,
  references: ReferenceTable,
): readonly Requirement[] {
  switch (occurrence.kind) {
    case "task":
      return bodyRequirementsOf(occurrence.task, references);
    case "schema":
      return schemaRequirementsOf(occurrence.schema, occurrence.context);
    case "policy":
      return policyRequirementsOf(occurrence.policy, occurrence.context);
    case "reference":
      return referenceRequirementsOf(occurrence, references);
    case "list":
    case "binders":
    case "expression":
    case "call":
    case "duration":
    case "filter":
      return none;
  }
}

function scheduleRequirementsOf(schedule: Schedule): readonly Requirement[] {
  const pointer = schedule.pointer;
  const scheduled: Requirement = {
    kind: "schedule",
    name: schedule.kind,
    pointer,
  };

  switch (schedule.kind) {
    case "on":
      return [scheduled, effectOf("listen", pointer)];
    case "every":
    case "cron":
    case "after":
      return [scheduled];
  }
}

function bodyRequirementsOf(
  task: Task,
  references: ReferenceTable,
): readonly Requirement[] {
  const pointer = task.pointer;

  switch (task.kind) {
    case "call":
      return callRequirementsOf(task.call, pointer);
    case "run":
      return processRequirementsOf(task.process, pointer);
    case "emit":
      return [effectOf("emit", pointer)];
    case "listen":
      return [effectOf("listen", pointer)];
    case "wait":
      return [effectOf("timer", pointer)];
    case "try":
      return retryRequirementsOf(task.catch.retry, pointer, references);
    case "do":
    case "for":
    case "fork":
    case "raise":
    case "set":
    case "switch":
      return none;
  }
}

function callRequirementsOf(
  call: Call,
  pointer: string,
): readonly Requirement[] {
  switch (call.kind) {
    case "asyncapi":
      return [
        effectOf(call.kind, pointer),
        ...protocolRequirementsOf(call, pointer),
      ];
    case "mcp": {
      const options = [...call.transport.options.keys()];
      const optionsNeeded = options.map((name) => mcpOptionOf(name, pointer));

      return [
        effectOf(call.kind, pointer),
        { kind: "mcp", name: call.transport.kind, pointer },
        ...optionsNeeded,
      ];
    }
    case "a2a":
    case "grpc":
    case "http":
    case "openapi":
      return [effectOf(call.kind, pointer)];
    case "function":
      return none;
  }
}

function protocolRequirementsOf(
  call: AsyncApiCall,
  pointer: string,
): readonly Requirement[] {
  const protocol = call.protocol;

  if (call.server !== null) {
    return none;
  }

  if (protocol === null) {
    return none;
  }

  return [{ kind: "asyncapi", name: protocol, pointer }];
}

function processRequirementsOf(
  process: Process,
  pointer: string,
): readonly Requirement[] {
  switch (process.kind) {
    case "workflow":
      return [effectOf("workflow", pointer)];
    case "container":
    case "shell":
      return [
        effectOf("process", pointer),
        { kind: "process", name: process.kind, pointer },
      ];
    case "script":
      return [
        effectOf("process", pointer),
        { kind: "process", name: process.kind, pointer },
        { kind: "script", name: process.language, pointer },
      ];
  }
}

function retryRequirementsOf(
  retry: RetryPolicy | Reference | null,
  pointer: string,
  references: ReferenceTable,
): readonly Requirement[] {
  if (retry === null) {
    return none;
  }

  switch (retry.kind) {
    case "retry":
      return [effectOf("timer", pointer)];
    case "reference":
      return declaredRetryRequirementsOf(retry, pointer, references);
  }
}

function declaredRetryRequirementsOf(
  retry: Reference,
  pointer: string,
  references: ReferenceTable,
): readonly Requirement[] {
  const declared = references.retries.has(retry.pointer);

  if (!declared) {
    return none;
  }

  return [effectOf("timer", pointer)];
}

function schemaRequirementsOf(
  schema: Schema,
  context: Context,
): readonly Requirement[] {
  switch (schema.kind) {
    case "inline":
      return none;
    case "external":
      return readRequirementsOf(schema, context);
  }
}

function readRequirementsOf(
  schema: ExternalSchema,
  context: Context,
): readonly Requirement[] {
  const pointer = readPointerOf(schema, context);

  if (pointer === null) {
    return none;
  }

  return [effectOf("resource", pointer)];
}

function referenceRequirementsOf(
  occurrence: ReferenceOccurrence | RetryReferenceOccurrence,
  references: ReferenceTable,
): readonly Requirement[] {
  switch (occurrence.table) {
    case "authentications":
      return namedPolicyRequirementsOf(
        occurrence.reference,
        occurrence.context,
        references,
      );
    case "errors":
    case "retries":
    case "timeouts":
    case "secrets":
      return none;
  }
}

function namedPolicyRequirementsOf(
  reference: Reference,
  context: Context,
  references: ReferenceTable,
): readonly Requirement[] {
  const policy = policyOf(reference, references);

  if (policy === null) {
    return none;
  }

  return policyRequirementsOf(policy, context);
}

function policyRequirementsOf(
  policy: AuthenticationPolicy,
  context: Context,
): readonly Requirement[] {
  const pointer = requestPointerOf(context);

  if (pointer === null) {
    return none;
  }

  const scheme: Requirement = {
    kind: "authentication",
    name: schemeOf(policy),
    pointer,
  };
  const grant = grantOf(policy);

  if (grant === null) {
    return [scheme];
  }

  return [scheme, { kind: "grant", name: grant, pointer }];
}

function requestPointerOf(context: Context): string | null {
  const schema = context.schema;

  if (schema === null) {
    return context.task;
  }

  return readPointerOf(schema, context);
}

function readPointerOf(
  schema: ExternalSchema,
  context: Context,
): string | null {
  const imported = importedUriOf(schema);

  if (imported !== null) {
    return null;
  }

  return context.task ?? schema.pointer;
}

function effectOf(name: EffectKind, pointer: string): Requirement {
  return { kind: "effect", name, pointer };
}

function mcpOptionOf(name: string, pointer: string): Requirement {
  return { kind: "mcpOption", name, pointer };
}
