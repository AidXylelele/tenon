import type { Findings } from './findings.js';
import type { FixedDuration } from './fixed-duration.js';
import type { ErrorFilter } from './error-filter.js';
import type { RetryPolicy } from './retry-policy.js';
import type { CatchClause } from './catch-clause.js';
import type { DataSpec } from './data-spec.js';
import type { Definition } from './definition.js';
import type { Duration } from './duration-factory.js';
import type { Endpoint } from './endpoint.js';
import type { Expression } from './expression.js';
import type { FlowDirective } from './flow-directive.js';
import type { AuthenticationPolicy } from './authentication-policy.js';
import type { Problem } from './problem.js';
import type { ReusableComponents } from './reusable-components.js';
import type { Task } from './task.js';
import type { TaskList } from './task-list.js';
import type { TaskSettings } from './task-settings.js';
import type { Template } from './template.js';
import type { SwitchCase } from './tasks/switch-case.js';
import type { WorkflowReference } from './workflow-reference.js';
import type { WorkflowTarget } from './workflow-target.js';

export type JsonValue =
  string | number | boolean | null | JsonValue[] | JsonObject;

export interface JsonObject {
  readonly [key: string]: JsonValue | undefined;
}

export interface PublishedWorkflow {
  readonly namespace: string;
  readonly name: string;
}

export interface PublishedVersion {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
}

export interface PublishedTargets {
  readonly workflows: readonly PublishedWorkflow[];
  readonly versions: readonly PublishedVersion[];
}

export interface ParsedDocument {
  readonly document: ParsedHeader;
  readonly input?: ParsedInput;
  readonly use?: ParsedUse;
  readonly do: ParsedTaskList;
  readonly timeout?: ParsedTimeout | string;
  readonly output?: ParsedOutput;
  readonly schedule?: JsonObject;
}

export interface ParsedHeader {
  readonly dsl: string;
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly title?: string;
  readonly summary?: string;
}

export interface ParsedInput {
  readonly schema?: JsonObject;
  readonly from?: string | JsonObject;
}

export interface ParsedOutput {
  readonly schema?: JsonObject;
  readonly as?: string | JsonObject;
}

export interface ParsedTimeout {
  readonly after: ParsedDuration;
}

export interface ParsedInlineDuration {
  readonly days?: number;
  readonly hours?: number;
  readonly minutes?: number;
  readonly seconds?: number;
  readonly milliseconds?: number;
}

export type ParsedDuration = string | ParsedInlineDuration;

export interface ParsedUse {
  readonly authentications?: Readonly<Record<string, ParsedAuthentication>>;
  readonly errors?: Readonly<Record<string, ParsedError>>;
  readonly extensions?: readonly JsonObject[];
  readonly functions?: Readonly<Record<string, ParsedTask>>;
  readonly retries?: Readonly<Record<string, ParsedRetryPolicy>>;
  readonly secrets?: readonly string[];
  readonly timeouts?: Readonly<Record<string, ParsedTimeout>>;
  readonly catalogs?: Readonly<Record<string, JsonObject>>;
}

export interface ParsedAuthentication {
  readonly [key: string]: JsonValue | undefined;
  readonly use?: string;
  readonly basic?: JsonObject;
  readonly bearer?: JsonObject;
  readonly digest?: JsonObject;
  readonly oauth2?: JsonObject;
  readonly oidc?: JsonObject;
}

export interface ParsedError {
  readonly [key: string]: JsonValue | undefined;
  readonly type: string;
  readonly status: number;
  readonly instance?: string;
  readonly title?: string;
  readonly detail?: string;
}

export interface ParsedRetryPolicy {
  readonly when?: string;
  readonly exceptWhen?: string;
  readonly delay?: ParsedDuration;
  readonly backoff?: ParsedBackoff;
  readonly limit?: ParsedRetryLimit;
  readonly jitter?: ParsedJitter;
}

export interface ParsedBackoff {
  readonly constant?: JsonObject;
  readonly linear?: JsonObject;
  readonly exponential?: JsonObject;
}

export interface ParsedRetryLimit {
  readonly attempt?: ParsedAttemptLimit;
  readonly duration?: ParsedDuration;
}

export interface ParsedAttemptLimit {
  readonly count?: number;
  readonly duration?: ParsedDuration;
}

export interface ParsedJitter {
  readonly from: ParsedDuration;
  readonly to: ParsedDuration;
}

export type ParsedTaskList = readonly Readonly<Record<string, ParsedTask>>[];

export interface ParsedTaskBase {
  readonly if?: string;
  readonly input?: ParsedInput;
  readonly output?: ParsedOutput;
  readonly export?: ParsedOutput;
  readonly timeout?: ParsedTimeout | string;
  readonly then?: string;
  readonly metadata?: JsonObject;
}

export interface ParsedCallTask extends ParsedTaskBase {
  readonly call: string;
  readonly with?: ParsedCallArguments;
}

export interface ParsedCallArguments {
  readonly [key: string]: JsonValue | undefined;
  readonly method?: string;
  readonly endpoint?: string | ParsedEndpoint;
  readonly document?: ParsedExternalResource;
  readonly operationId?: string;
  readonly authentication?: ParsedAuthentication;
  readonly output?: string;
  readonly redirect?: boolean;
}

export interface ParsedEndpoint {
  readonly [key: string]: JsonValue | undefined;
  readonly uri: string;
  readonly authentication?: ParsedAuthentication;
}

export interface ParsedExternalResource {
  readonly [key: string]: JsonValue | undefined;
  readonly name?: string;
  readonly endpoint: string | ParsedEndpoint;
}

export interface ParsedDoTask extends ParsedTaskBase {
  readonly do: ParsedTaskList;
}

export interface ParsedForTask extends ParsedTaskBase {
  readonly for: ParsedForLoop;
  readonly while?: string;
  readonly do: ParsedTaskList;
}

export interface ParsedForLoop {
  readonly each?: string;
  readonly in: string;
  readonly at?: string;
}

export interface ParsedForkTask extends ParsedTaskBase {
  readonly fork: ParsedFork;
}

export interface ParsedFork {
  readonly branches: ParsedTaskList;
  readonly compete?: boolean;
}

export interface ParsedSwitchTask extends ParsedTaskBase {
  readonly switch: readonly Readonly<Record<string, ParsedSwitchCase>>[];
}

export interface ParsedSwitchCase {
  readonly when?: string;
  readonly then: string;
}

export interface ParsedTryTask extends ParsedTaskBase {
  readonly try: ParsedTaskList;
  readonly catch: ParsedCatch;
}

export interface ParsedCatch {
  readonly errors?: ParsedErrorFilter;
  readonly as?: string;
  readonly when?: string;
  readonly exceptWhen?: string;
  readonly retry?: string | ParsedRetryPolicy;
  readonly do?: ParsedTaskList;
}

export interface ParsedErrorFilter {
  readonly with?: Readonly<Record<string, string | number>>;
}

export interface ParsedSetTask extends ParsedTaskBase {
  readonly set: JsonObject | string;
}

export interface ParsedRaiseTask extends ParsedTaskBase {
  readonly raise: ParsedRaise;
}

export interface ParsedRaise {
  readonly error: string | ParsedError;
}

export interface ParsedEmitTask extends ParsedTaskBase {
  readonly emit: ParsedEmit;
}

export interface ParsedEmit {
  readonly event: ParsedEmittedEvent;
}

export interface ParsedEmittedEvent {
  readonly with: JsonObject;
}

export interface ParsedRunTask extends ParsedTaskBase {
  readonly run: ParsedRun;
}

export interface ParsedRun {
  readonly await?: boolean;
  readonly return?: string;
  readonly workflow?: ParsedRunWorkflow;
  readonly script?: ParsedScript;
  readonly shell?: ParsedShell;
  readonly container?: JsonObject;
}

export interface ParsedRunWorkflow {
  readonly namespace: string;
  readonly name: string;
  readonly version?: string;
  readonly input?: JsonObject;
}

export interface ParsedScript {
  readonly [key: string]: JsonValue | undefined;
  readonly language: string;
  readonly code?: string;
  readonly source?: JsonObject;
  readonly arguments?: JsonObject;
  readonly environment?: JsonObject;
  readonly stdin?: string;
}

export interface ParsedShell {
  readonly [key: string]: JsonValue | undefined;
  readonly command: string;
  readonly arguments?: JsonObject;
  readonly environment?: JsonObject;
}

export interface ParsedWaitTask extends ParsedTaskBase {
  readonly wait: ParsedDuration;
}

export interface ParsedListenTask extends ParsedTaskBase {
  readonly listen: JsonObject;
}

export type ParsedTask =
  | ParsedCallTask
  | ParsedDoTask
  | ParsedForkTask
  | ParsedEmitTask
  | ParsedForTask
  | ParsedListenTask
  | ParsedRaiseTask
  | ParsedRunTask
  | ParsedSetTask
  | ParsedSwitchTask
  | ParsedTryTask
  | ParsedWaitTask;

export interface Backoff {
  delayFor(attempt: number, delayMs: number): number;
}

export interface ConformanceStatement {
  readonly dsl: readonly string[];
  readonly tasks: readonly string[];
  readonly calls: readonly string[];
  readonly runs: readonly string[];
  readonly scriptLanguages: readonly string[];
  readonly authentications: readonly string[];
  readonly excluded: readonly string[];
  readonly contradictions: readonly string[];
}

export interface ScopeProps {
  readonly pointer: string;
  readonly findings: Findings;
  readonly components: ReusableComponents;
  readonly tasks: ReadonlySet<string>;
  readonly variables: ReadonlySet<string>;
}

export interface ExpressionProps {
  readonly pointer: string;
  readonly program: string;
  readonly variables: readonly string[];
}

export interface TemplateProps {
  readonly pointer: string;
  readonly value: JsonValue;
}

export interface DataSpecProps {
  readonly transform: Expression | Template | null;
  readonly schema: JsonObject | null;
}

export interface WorkflowErrorProps {
  readonly type: string;
  readonly status: number;
  readonly instance: string | null;
  readonly title: string | null;
  readonly detail: string | null;
}

export interface RetryPolicyProps {
  readonly when: Expression | null;
  readonly exceptWhen: Expression | null;
  readonly delay: FixedDuration | null;
  readonly backoff: Backoff;
  readonly attemptCount: number | null;
  readonly attemptDuration: FixedDuration | null;
  readonly totalDuration: FixedDuration | null;
  readonly jitterFrom: FixedDuration | null;
  readonly jitterTo: FixedDuration | null;
}

export interface CatchClauseProps {
  readonly filter: ErrorFilter;
  readonly as: string;
  readonly when: Expression | null;
  readonly exceptWhen: Expression | null;
  readonly retry: RetryPolicy | null;
  readonly handler: TaskList | null;
}

export interface AuthenticationPolicyProps {
  readonly scheme: string;
  readonly settings: Template | null;
}

export interface DoTaskProps {
  readonly name: string;
  readonly reference: string;
  readonly settings: TaskSettings;
  readonly body: TaskList;
}

export interface ForTaskProps {
  readonly name: string;
  readonly reference: string;
  readonly settings: TaskSettings;
  readonly each: string;
  readonly collection: Expression | null;
  readonly at: string;
  readonly whilst: Expression | null;
  readonly body: TaskList;
}

export interface ForkTaskProps {
  readonly name: string;
  readonly reference: string;
  readonly settings: TaskSettings;
  readonly branches: TaskList;
  readonly compete: boolean;
}

export interface SwitchTaskProps {
  readonly name: string;
  readonly reference: string;
  readonly settings: TaskSettings;
  readonly cases: readonly SwitchCase[];
}

export interface TryTaskProps {
  readonly name: string;
  readonly reference: string;
  readonly settings: TaskSettings;
  readonly body: TaskList;
  readonly catchClause: CatchClause;
}

export interface SetTaskProps {
  readonly name: string;
  readonly reference: string;
  readonly settings: TaskSettings;
  readonly value: Template | null;
}

export interface RaiseTaskProps {
  readonly name: string;
  readonly reference: string;
  readonly settings: TaskSettings;
  readonly error: Template;
}

export interface EmitTaskProps {
  readonly name: string;
  readonly reference: string;
  readonly settings: TaskSettings;
  readonly event: Template | null;
}

export interface CallTaskProps {
  readonly name: string;
  readonly reference: string;
  readonly settings: TaskSettings;
  readonly kind: string;
  readonly callee: Task | null;
  readonly arguments: Template | null;
  readonly endpoint: Endpoint | null;
  readonly document: Endpoint | null;
  readonly authentication: AuthenticationPolicy | null;
}

export interface RunWorkflowTaskProps {
  readonly name: string;
  readonly reference: string;
  readonly settings: TaskSettings;
  readonly target: WorkflowTarget;
  readonly input: Template | null;
  readonly awaits: boolean;
}

export interface RunScriptTaskProps {
  readonly name: string;
  readonly reference: string;
  readonly settings: TaskSettings;
  readonly language: string;
  readonly script: Template | null;
  readonly awaits: boolean;
  readonly returns: string;
}

export interface RunShellTaskProps {
  readonly name: string;
  readonly reference: string;
  readonly settings: TaskSettings;
  readonly shell: Template | null;
  readonly awaits: boolean;
  readonly returns: string;
}

export interface TaskSettingsProps {
  readonly condition: Expression | null;
  readonly input: DataSpec;
  readonly output: DataSpec;
  readonly export: DataSpec;
  readonly timeout: Duration | null;
  readonly then: FlowDirective;
}

export interface SwitchCaseProps {
  readonly name: string;
  readonly when: Expression | null;
  readonly then: FlowDirective;
}

export interface DefinitionProps {
  readonly document: ParsedDocument;
  readonly input: DataSpec;
  readonly output: DataSpec;
  readonly timeout: Duration | null;
  readonly components: ReusableComponents;
  readonly body: TaskList;
}

export interface DefinitionBuildProps {
  readonly definition: Definition | null;
  readonly problems: readonly Problem[];
  readonly expressions: readonly Expression[];
  readonly references: readonly WorkflowReference[];
}

export interface ReportProps {
  readonly definition: Definition | null;
  readonly problems: readonly Problem[];
}
