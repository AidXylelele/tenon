import type { Attempt } from './attempt.js';
import type { Authentication } from './authentication.js';
import type { Backoff } from './backoffs/backoff.js';
import type { CallOutput } from './call-output.js';
import type { CatchClause } from './catch-clause.js';
import type { CloudEvent } from './cloud-event.js';
import type { Definition } from './definition.js';
import type { Endpoint } from './endpoint.js';
import type {
  AuthenticationScheme,
  CallKind,
  DslVersion,
  RunKind,
  ScriptLanguage,
} from './enums.js';
import type { ErrorCondition } from './error-condition.js';
import type { ErrorFilter } from './error-filter.js';
import type { Export } from './export.js';
import type { Expression } from './expression.js';
import type { ExpressionDuration } from './expression-duration.js';
import type { FixedDuration } from './fixed-duration.js';
import type { FlowDirective } from './flow-directive.js';
import type { Input } from './input.js';
import type { JsonPointer } from './json-pointer.js';
import type { Outcome } from './outcome.js';
import type { Output } from './output.js';
import type { ProcessReturn } from './process-return.js';
import type { KindProgress } from './progress/kind-progress.js';
import type { EvaluationResult } from './results/evaluation-result.js';
import type { ProcessResult } from './results/process-result.js';
import type { ServiceResult } from './results/service-result.js';
import type { ValidationResult } from './results/validation-result.js';
import type { RetryStrategy } from './retry-strategy.js';
import type { ReusableComponents } from './reusable-components.js';
import type { RoundResults } from './round-results.js';
import type { Schema } from './schema.js';
import type { TaskScope } from './scopes/task-scope.js';
import type { Sequence } from './sequence.js';
import type { SwitchCase } from './switch-case.js';
import type { TaskBase } from './task-base.js';
import type { TaskList } from './task-list.js';
import type { Task } from './tasks/task.js';
import type { Template } from './template.js';
import type { WorkflowError } from './workflow-error.js';
import type { WorkflowName } from './workflow-name.js';
import type { WorkflowTarget } from './workflow-target.js';
import type { Phase } from './phase.js';
import type { DueTime } from './due-time.js';

export type JsonValue =
  string | number | boolean | null | JsonValue[] | JsonObject;

export interface JsonObject {
  readonly [key: string]: JsonValue | undefined;
}

export interface InlineDurationParts {
  readonly days?: number;
  readonly hours?: number;
  readonly minutes?: number;
  readonly seconds?: number;
  readonly milliseconds?: number;
}

export interface ExpressionProps {
  readonly pointer: JsonPointer;
  readonly program: string;
}

export interface NewExpression {
  readonly text: string;
  readonly pointer: JsonPointer;
}

export interface TemplateProps {
  readonly pointer: JsonPointer;
  readonly value: JsonValue;
}

export interface SchemaProps {
  readonly pointer: JsonPointer;
  readonly document: JsonObject;
}

export interface InputProps {
  readonly from: Expression | Template | null;
  readonly schema: Schema | null;
}

export interface OutputProps {
  readonly as: Expression | Template | null;
  readonly schema: Schema | null;
}

export interface ExportProps {
  readonly as: Expression | Template | null;
  readonly schema: Schema | null;
}

export interface ErrorConditionProps {
  readonly when: Expression | null;
  readonly exceptWhen: Expression | null;
}

export interface RetryStrategyProps {
  readonly condition: ErrorCondition;
  readonly delay: FixedDuration | null;
  readonly backoff: Backoff;
  readonly attemptCount: number | null;
  readonly totalDuration: FixedDuration | null;
  readonly jitterFrom: FixedDuration | null;
  readonly jitterTo: FixedDuration | null;
}

export interface CatchClauseProps {
  readonly filter: ErrorFilter;
  readonly as: string | null;
  readonly condition: ErrorCondition;
  readonly retry: RetryStrategy | null;
  readonly handler: TaskList | null;
}

export interface EndpointProps {
  readonly uri: Template;
  readonly authentication: Authentication | null;
}

export interface AuthenticationProps {
  readonly scheme: AuthenticationScheme;
  readonly settings: Template;
}

export interface ReusableComponentsProps {
  readonly authentications: ReadonlyMap<string, Authentication>;
  readonly errors: ReadonlyMap<string, Template>;
  readonly retries: ReadonlyMap<string, RetryStrategy>;
  readonly timeouts: ReadonlyMap<string, FixedDuration | ExpressionDuration>;
  readonly functions: ReadonlyMap<string, Task>;
}

export interface TaskBaseProps {
  readonly condition: Expression | null;
  readonly input: Input;
  readonly output: Output;
  readonly export: Export;
  readonly timeout: FixedDuration | ExpressionDuration | null;
  readonly then: FlowDirective;
}

export interface TaskProps {
  readonly name: string;
  readonly reference: JsonPointer;
  readonly base: TaskBase;
}

export interface TaskListProps {
  readonly reference: JsonPointer;
  readonly tasks: readonly Task[];
}

export interface DoTaskProps extends TaskProps {
  readonly body: TaskList;
}

export interface ForTaskProps extends TaskProps {
  readonly each: string | null;
  readonly at: string | null;
  readonly collection: Expression;
  readonly whilst: Expression | null;
  readonly body: TaskList;
}

export interface ForkTaskProps extends TaskProps {
  readonly branches: TaskList;
  readonly compete: boolean | null;
}

export interface SwitchTaskProps extends TaskProps {
  readonly cases: readonly SwitchCase[];
}

export interface SwitchCaseProps {
  readonly reference: JsonPointer;
  readonly when: Expression | null;
  readonly then: FlowDirective;
}

export interface TryTaskProps extends TaskProps {
  readonly body: TaskList;
  readonly catchClause: CatchClause;
}

export interface SetTaskProps extends TaskProps {
  readonly value: Expression | Template;
}

export interface RaiseTaskProps extends TaskProps {
  readonly error: Template;
}

export interface EmitTaskProps extends TaskProps {
  readonly event: Template;
}

export interface HttpCallTaskProps extends TaskProps {
  readonly endpoint: Endpoint;
  readonly arguments: Template;
  readonly output: CallOutput;
}

export interface OpenApiCallTaskProps extends TaskProps {
  readonly document: Endpoint;
  readonly arguments: Template;
  readonly authentication: Authentication | null;
  readonly output: CallOutput;
}

export interface FunctionCallTaskProps extends TaskProps {
  readonly function: string;
  readonly arguments: Template | null;
}

export interface RunWorkflowTaskProps extends TaskProps {
  readonly target: WorkflowTarget;
  readonly input: Template | null;
  readonly awaits: boolean | null;
}

export interface RunScriptTaskProps extends TaskProps {
  readonly language: ScriptLanguage;
  readonly script: Template;
  readonly awaits: boolean | null;
  readonly returns: ProcessReturn | null;
}

export interface RunShellTaskProps extends TaskProps {
  readonly shell: Template;
  readonly awaits: boolean | null;
  readonly returns: ProcessReturn | null;
}

export interface DefinitionProps {
  readonly document: JsonObject;
  readonly workflow: WorkflowName;
  readonly version: string;
  readonly dslVersion: DslVersion;
  readonly input: Input;
  readonly output: Output;
  readonly timeout: FixedDuration | ExpressionDuration | null;
  readonly body: TaskList;
  readonly components: ReusableComponents;
}

export interface CloudEventProps {
  readonly id: string;
  readonly source: string;
  readonly type: string;
  readonly time: Date | null;
  readonly subject: string | null;
  readonly dataContentType: string | null;
  readonly dataSchema: string | null;
  readonly data: JsonValue;
  readonly extensions: JsonObject;
}

export interface Evaluation {
  readonly id: string;
  readonly program: string;
  readonly data: JsonValue;
  readonly arguments: JsonObject;
}

export interface Validation {
  readonly id: string;
  readonly schema: JsonObject;
  readonly data: JsonValue;
}

export interface ServiceAuthentication {
  readonly scheme: AuthenticationScheme;
  readonly settings: JsonValue;
}

export interface ServiceEndpoint {
  readonly uri: JsonValue;
  readonly authentication: ServiceAuthentication | null;
}

export interface ServiceCall {
  readonly id: string;
  readonly kind: CallKind;
  readonly endpoint: ServiceEndpoint;
  readonly arguments: JsonValue;
  readonly authentication: ServiceAuthentication | null;
  readonly input: JsonValue;
  // The earliest deadline of the calling task and the tasks around it; null: none.
  readonly deadline: Date | null;
}

export interface ProcessRun {
  readonly id: string;
  readonly kind: RunKind;
  readonly language: ScriptLanguage | null;
  readonly process: JsonValue;
  // The earliest deadline of an awaiting task and the tasks around it; null: none or detached.
  readonly deadline: Date | null;
}

export interface RoundWorkProps {
  readonly evaluations: readonly Evaluation[];
  readonly validations: readonly Validation[];
  readonly calls: readonly ServiceCall[];
  readonly processes: readonly ProcessRun[];
}

export interface RoundResultsProps {
  readonly evaluated: readonly EvaluationResult[];
  readonly validated: readonly ValidationResult[];
  readonly responses: readonly ServiceResult[];
  readonly processes: readonly ProcessResult[];
}

export interface ServiceRespondedProps {
  readonly id: string;
  readonly status: number;
  readonly headers: JsonObject;
  readonly content: JsonValue;
  readonly body: string;
  readonly request: JsonObject;
  readonly authorization: JsonObject | null;
}

export interface ProcessExitedProps {
  readonly id: string;
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface WorkflowErrorProps {
  readonly type: string;
  readonly status: number;
  readonly instance: string;
  readonly title: string | null;
  readonly detail: string | null;
}

export interface TaskStart {
  readonly reference: JsonPointer;
  readonly input: JsonValue;
  readonly variables: JsonObject;
}

export interface SubWorkflowRequest {
  readonly target: WorkflowTarget;
  readonly input: JsonValue;
  readonly awaited: boolean;
}

export interface DetachedWorkflow {
  readonly workflow: WorkflowName;
  readonly versionId: string;
  readonly input: JsonValue;
}

export interface SubWorkflowEnding {
  readonly phase: Phase;
  readonly output: JsonValue;
  readonly error: WorkflowError | null;
}

export interface OutcomeProps {
  readonly output: JsonValue;
  readonly failure: WorkflowError | null;
  readonly directive: FlowDirective | null;
  readonly authorization: JsonObject | null;
  readonly emitted: CloudEvent | null;
  readonly detachedProcess: ProcessRun | null;
  readonly detachedWorkflow: DetachedWorkflow | null;
}

export interface TaskEndingProps {
  readonly output: JsonValue;
  readonly failure: WorkflowError | null;
  readonly directive: FlowDirective | null;
  readonly skipped: boolean;
  readonly exported: boolean;
  readonly context: JsonValue;
  readonly body: Outcome | null;
}

export interface TaskCompletion {
  readonly output: JsonValue;
  readonly then: FlowDirective;
  readonly exported: boolean;
  readonly context: JsonValue;
  readonly outcome: Outcome;
}

export interface TaskScopeProps<T extends Task> {
  readonly id: string;
  readonly task: T;
  readonly definition: Definition;
  readonly rawInput: JsonValue;
  readonly context: JsonValue;
  readonly instanceId: string;
  readonly workflowInput: JsonValue;
  readonly workflowStartedAt: Date;
  readonly runtime: JsonObject;
  readonly variables: JsonObject;
  readonly startedAt: Date;
  readonly deadline: DueTime;
  readonly now: Date;
}

export interface BodyStageProps {
  readonly input: JsonValue;
  readonly deadline: DueTime;
  readonly body: KindProgress;
}

export interface OutputStageProps {
  readonly input: JsonValue;
  readonly deadline: DueTime;
  readonly outcome: Outcome;
}

export interface ExportStageProps extends OutputStageProps {
  readonly output: JsonValue;
}

export interface ExportCheckStageProps {
  readonly deadline: DueTime;
  readonly outcome: Outcome;
  readonly output: JsonValue;
  readonly context: JsonValue;
  readonly exported: boolean;
}

export interface SequenceProps {
  readonly position: number;
  readonly variables: JsonObject;
}

export interface ForProgressProps {
  readonly items: readonly JsonValue[] | null;
  readonly index: number;
  readonly data: JsonValue;
  readonly sequence: Sequence | null;
}

export interface ForkProgressProps {
  readonly outputs: readonly JsonValue[];
  readonly pending: readonly number[];
}

export interface AttemptProps {
  readonly count: number;
  readonly firstStartedAt: Date;
}

export interface TryProgressProps {
  readonly attempt: Attempt;
  readonly sequence: Sequence;
}

export interface CatchProgressProps {
  readonly attempt: Attempt;
  readonly error: WorkflowError;
}

export interface RetryProgressProps {
  readonly attempt: Attempt;
  readonly wakeAt: Date;
}

export interface ValueTask extends Task {
  readonly template: Expression | Template;
  outcomeOf(value: JsonValue, scope: TaskScope): Outcome;
}

export interface CallTask extends Task {
  readonly templates: readonly (Expression | Template)[];
  readonly output: CallOutput;
  callFrom(
    id: string,
    prefix: string,
    results: RoundResults,
    input: JsonValue,
    deadline: Date | null,
  ): ServiceCall;
}

export interface ProcessTask extends Task {
  readonly process: Template;
  readonly awaits: boolean;
  readonly returns: ProcessReturn;
  runFrom(id: string, process: JsonValue, deadline: Date | null): ProcessRun;
}
