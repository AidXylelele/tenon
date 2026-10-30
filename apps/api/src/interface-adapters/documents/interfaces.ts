import type {
  JsonObject,
  JsonValue,
} from '../../domain/automation/language/interfaces.js';
import type { DslOutcomeKind } from './enums.js';

export interface Workflow {
  readonly document: Document;
  readonly input?: Input;
  readonly use?: Use;
  readonly do: TaskList;
  readonly timeout?: Timeout | string;
  readonly output?: Output;
  readonly schedule?: JsonObject;
}

export interface Document {
  readonly dsl: string;
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
}

export interface Input {
  readonly schema?: JsonObject;
  readonly from?: string | JsonObject;
}

export interface Output {
  readonly schema?: JsonObject;
  readonly as?: string | JsonObject;
}

export interface Timeout {
  readonly after: Duration;
}

export interface InlineDuration {
  readonly days?: number;
  readonly hours?: number;
  readonly minutes?: number;
  readonly seconds?: number;
  readonly milliseconds?: number;
}

export type Duration = string | InlineDuration;

export interface Use {
  readonly authentications?: Readonly<Record<string, Authentication>>;
  readonly errors?: Readonly<Record<string, JsonObject>>;
  readonly extensions?: readonly JsonObject[];
  readonly functions?: Readonly<Record<string, Task>>;
  readonly retries?: Readonly<Record<string, RetryPolicy>>;
  readonly secrets?: readonly string[];
  readonly timeouts?: Readonly<Record<string, Timeout>>;
  readonly catalogs?: JsonObject;
}

export interface Authentication {
  readonly [key: string]: JsonValue | undefined;
  readonly use?: string;
  readonly basic?: SchemeSettings;
  readonly bearer?: SchemeSettings;
  readonly digest?: SchemeSettings;
  readonly oauth2?: SchemeSettings;
  readonly oidc?: SchemeSettings;
}

export interface SchemeSettings {
  readonly [key: string]: JsonValue | undefined;
  readonly use?: string;
  readonly grant?: string;
}

export interface RetryPolicy {
  readonly when?: string;
  readonly exceptWhen?: string;
  readonly delay?: Duration;
  readonly backoff?: Backoff;
  readonly limit?: RetryLimit;
  readonly jitter?: Jitter;
}

export interface Backoff {
  readonly linear?: JsonObject;
  readonly exponential?: JsonObject;
}

export interface RetryLimit {
  readonly attempt?: AttemptLimit;
  readonly duration?: Duration;
}

export interface AttemptLimit {
  readonly count?: number;
  readonly duration?: Duration;
}

export interface Jitter {
  readonly from: Duration;
  readonly to: Duration;
}

export type TaskList = readonly Readonly<Record<string, Task>>[];

export interface TaskBase {
  readonly if?: string;
  readonly input?: Input;
  readonly output?: Output;
  readonly export?: Output;
  readonly timeout?: Timeout | string;
  readonly then?: string;
}

export interface CallTask extends TaskBase {
  readonly call: string;
  readonly with?: JsonObject;
}

export interface HttpArguments {
  readonly [key: string]: JsonValue | undefined;
  readonly method: string;
  readonly endpoint: string | Endpoint;
  readonly headers?: JsonValue;
  readonly body?: JsonValue;
  readonly query?: JsonValue;
  readonly output?: string;
  readonly redirect?: boolean;
}

export interface OpenApiArguments {
  readonly [key: string]: JsonValue | undefined;
  readonly document: ExternalResource;
  readonly operationId: string;
  readonly parameters?: JsonValue;
  readonly authentication?: Authentication;
  readonly output?: string;
  readonly redirect?: boolean;
}

export interface Endpoint {
  readonly [key: string]: JsonValue | undefined;
  readonly uri: string;
  readonly authentication?: Authentication;
}

export interface ExternalResource {
  readonly [key: string]: JsonValue | undefined;
  readonly endpoint: string | Endpoint;
}

export interface DoTask extends TaskBase {
  readonly do: TaskList;
}

export interface ForTask extends TaskBase {
  readonly for: ForLoop;
  readonly while?: string;
  readonly do: TaskList;
}

export interface ForLoop {
  readonly each?: string;
  readonly in: string;
  readonly at?: string;
}

export interface ForkTask extends TaskBase {
  readonly fork: Fork;
}

export interface Fork {
  readonly branches: TaskList;
  readonly compete?: boolean;
}

export interface SwitchTask extends TaskBase {
  readonly switch: readonly Readonly<Record<string, SwitchCase>>[];
}

export interface SwitchCase {
  readonly when?: string;
  readonly then: string;
}

export interface TryTask extends TaskBase {
  readonly try: TaskList;
  readonly catch: Catch;
}

export interface Catch {
  readonly errors?: ErrorFilter;
  readonly as?: string;
  readonly when?: string;
  readonly exceptWhen?: string;
  readonly retry?: string | RetryPolicy;
  readonly do?: TaskList;
}

export interface ErrorFilter {
  readonly with?: ErrorProperties;
}

export interface ErrorProperties {
  readonly type?: string;
  readonly status?: number;
  readonly instance?: string;
  readonly title?: string;
  readonly details?: string;
}

export interface SetTask extends TaskBase {
  readonly set: JsonObject | string;
}

export interface RaiseTask extends TaskBase {
  readonly raise: Raise;
}

export interface Raise {
  readonly error: string | JsonObject;
}

export interface EmitTask extends TaskBase {
  readonly emit: Emit;
}

export interface Emit {
  readonly event: EmittedEvent;
}

export interface EmittedEvent {
  readonly with: JsonObject;
}

export interface RunTask extends TaskBase {
  readonly run: Run;
}

export interface RunConfiguration {
  readonly await?: boolean;
  readonly return?: string;
}

export interface RunWorkflow extends RunConfiguration {
  readonly workflow: SubflowConfiguration;
}

export interface RunScript extends RunConfiguration {
  readonly script: Script;
}

export interface RunShell extends RunConfiguration {
  readonly shell: JsonObject;
}

export interface RunContainer extends RunConfiguration {
  readonly container: JsonObject;
}

export type Run = RunWorkflow | RunScript | RunShell | RunContainer;

export interface SubflowConfiguration {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly input?: JsonObject;
}

export interface Script {
  readonly [key: string]: JsonValue | undefined;
  readonly language: string;
  readonly source?: JsonObject;
}

export interface WaitTask extends TaskBase {
  readonly wait: Duration;
}

export interface ListenTask extends TaskBase {
  readonly listen: JsonObject;
}

export type Task =
  | CallTask
  | DoTask
  | EmitTask
  | ForTask
  | ForkTask
  | ListenTask
  | RaiseTask
  | RunTask
  | SetTask
  | SwitchTask
  | TryTask
  | WaitTask;

export interface DslParsed {
  readonly kind: DslOutcomeKind.Parsed;
  readonly workflow: Workflow;
}

export interface DslFailure {
  readonly kind: DslOutcomeKind.Failure;
  readonly pointer: string;
  readonly failure: string;
}

export type DslOutcome = DslParsed | DslFailure;

export abstract class OpenWorkflowClient {
  abstract parse(text: string): DslOutcome;
}
