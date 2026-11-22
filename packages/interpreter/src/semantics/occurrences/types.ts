import type {
  AuthenticationPolicy,
  Duration,
  ErrorDefinition,
  EventFilter,
  Expression,
  ExternalSchema,
  FunctionCall,
  Reference,
  RetryPolicy,
  Schema,
  Task,
  TaskList,
  Timeout,
} from "../../syntax/index.js";
import type { Scope } from "./scopes.js";

export type ListRole = "sequence" | "branches";

export type Position =
  | "workflowInput"
  | "workflowTimeout"
  | "workflowOutput"
  | "taskIf"
  | "taskInput"
  | "taskTimeout"
  | "taskBody"
  | "taskOutput"
  | "taskExport"
  | "iteratorOutput"
  | "iteratorExport"
  | "extensionWhen"
  | "scheduleOn"
  | "scheduleTiming"
  | "authenticationComponent"
  | "catalogComponent"
  | "errorComponent"
  | "retryComponent"
  | "timeoutComponent";

export type BinderRole = "item" | "index" | "error";

export interface BinderBinding {
  readonly kind: "binder";
  readonly declaration: string;
  readonly role: BinderRole;
  readonly name: string;
}

export type NamedComponent =
  AuthenticationPolicy | ErrorDefinition | RetryPolicy | Timeout;

export interface Context {
  readonly position: Position;
  readonly scope: Scope;
  readonly task: string | null;
  readonly function: string | null;
  readonly schema: ExternalSchema | null;
  readonly component: NamedComponent | null;
  readonly place: string | null;
}

interface TaskOccurrence {
  readonly kind: "task";
  readonly task: Task;
  readonly context: Context;
}

export interface ListOccurrence {
  readonly kind: "list";
  readonly list: TaskList;
  readonly role: ListRole;
  readonly context: Context;
}

interface BindersOccurrence {
  readonly kind: "binders";
  readonly binders: readonly BinderBinding[];
  readonly context: Context;
}

export interface ExpressionOccurrence {
  readonly kind: "expression";
  readonly expression: Expression;
  readonly context: Context;
}

export interface ReferenceOccurrence {
  readonly kind: "reference";
  readonly table: "authentications" | "errors" | "timeouts" | "secrets";
  readonly reference: Reference;
  readonly context: Context;
}

export interface RetryReferenceOccurrence {
  readonly kind: "reference";
  readonly table: "retries";
  readonly reference: Reference;
  readonly context: Context;
  readonly handler: Context;
}

export interface CallOccurrence {
  readonly kind: "call";
  readonly task: string;
  readonly call: FunctionCall;
  readonly context: Context;
}

interface DurationOccurrence {
  readonly kind: "duration";
  readonly duration: Duration;
  readonly context: Context;
}

interface SchemaOccurrence {
  readonly kind: "schema";
  readonly schema: Schema;
  readonly context: Context;
}

interface FilterOccurrence {
  readonly kind: "filter";
  readonly filter: EventFilter;
  readonly context: Context;
}

interface PolicyOccurrence {
  readonly kind: "policy";
  readonly policy: AuthenticationPolicy;
  readonly context: Context;
}

export type Occurrence =
  | TaskOccurrence
  | ListOccurrence
  | BindersOccurrence
  | ExpressionOccurrence
  | ReferenceOccurrence
  | RetryReferenceOccurrence
  | CallOccurrence
  | DurationOccurrence
  | SchemaOccurrence
  | FilterOccurrence
  | PolicyOccurrence;

export type Walk<Component> = (
  component: Component,
  context: Context,
) => readonly Occurrence[];
