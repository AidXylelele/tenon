import type { Authentication } from './authentication.js';
import type { CatchClause } from './catch-clause.js';
import type { Endpoint } from './endpoint.js';
import type {
  AuthenticationScheme,
  BackoffKind,
  ProcessReturn,
  ScriptLanguage,
} from './enums.js';
import type { ErrorFilter } from './error-filter.js';
import type { Export } from './export.js';
import type { Expression } from './expression.js';
import type { ExpressionDuration } from './expression-duration.js';
import type { FixedDuration } from './fixed-duration.js';
import type { FlowDirective } from './flow-directive.js';
import type { Input } from './input.js';
import type { JsonPointer } from './json-pointer.js';
import type { Output } from './output.js';
import type { RetryStrategy } from './retry-strategy.js';
import type { ReusableComponents } from './reusable-components.js';
import type { Task } from './task.js';
import type { TaskBase } from './task-base.js';
import type { TaskList } from './task-list.js';
import type { SwitchCase } from './tasks/switch-case.js';
import type { Template } from './template.js';
import type { WorkflowName } from './workflow-name.js';
import type { WorkflowTarget } from './workflow-target.js';

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

export interface InputProps {
  readonly from: Expression | Template | null;
  readonly schema: JsonObject | null;
}

export interface OutputProps {
  readonly as: Expression | Template | null;
  readonly schema: JsonObject | null;
}

export interface ExportProps {
  readonly as: Expression | Template | null;
  readonly schema: JsonObject | null;
}

export interface FlowDirectiveProps {
  readonly value: string | null;
  readonly pointer: JsonPointer;
}

export interface RetryStrategyProps {
  readonly when: Expression | null;
  readonly exceptWhen: Expression | null;
  readonly delay: FixedDuration | null;
  readonly backoff: BackoffKind;
  readonly attemptCount: number | null;
  readonly attemptDuration: FixedDuration | null;
  readonly totalDuration: FixedDuration | null;
  readonly jitterFrom: FixedDuration | null;
  readonly jitterTo: FixedDuration | null;
}

export interface CatchClauseProps {
  readonly filter: ErrorFilter;
  readonly as: string | null;
  readonly when: Expression | null;
  readonly exceptWhen: Expression | null;
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
  readonly name: string;
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
}

export interface OpenApiCallTaskProps extends TaskProps {
  readonly document: Endpoint;
  readonly arguments: Template;
  readonly authentication: Authentication | null;
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
  readonly workflow: WorkflowName;
  readonly version: string;
  readonly dslVersion: string;
  readonly input: Input;
  readonly output: Output;
  readonly timeout: FixedDuration | ExpressionDuration | null;
  readonly body: TaskList;
  readonly components: ReusableComponents;
}

export interface ConformanceStatementProps {
  readonly dsl: readonly string[];
  readonly tasks: readonly string[];
  readonly calls: readonly string[];
  readonly runs: readonly string[];
  readonly scriptLanguages: readonly string[];
  readonly authentications: readonly string[];
  readonly excluded: readonly string[];
  readonly contradictions: readonly string[];
}
