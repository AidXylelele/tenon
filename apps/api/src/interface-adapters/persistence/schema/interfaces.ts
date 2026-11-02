import type {
  EndingKind,
  OriginKind,
  ProgressKind,
  TaskStage,
} from './enums.js';
import type {
  AuthenticationScheme,
  CallKind,
  RunKind,
  ScriptLanguage,
} from '../../../domain/automation/language/enums.js';
import type {
  JsonObject,
  JsonValue,
} from '../../../domain/automation/language/interfaces.js';

export interface AccountConfig {
  readonly passwordHash?: string;
}

export interface UserOriginState {
  readonly kind: OriginKind.User;
  readonly userId: string;
}

export interface ParentOriginState {
  readonly kind: OriginKind.Parent;
  readonly instanceId: string;
  readonly taskId: string;
}

export type OriginState = UserOriginState | ParentOriginState;

export interface ServiceAuthenticationState {
  readonly scheme: AuthenticationScheme;
  readonly settings: JsonValue;
}

export interface ServiceEndpointState {
  readonly uri: JsonValue;
  readonly authentication: ServiceAuthenticationState | null;
}

export interface ServiceCallState {
  readonly id: string;
  readonly kind: CallKind;
  readonly endpoint: ServiceEndpointState;
  readonly arguments: JsonValue;
  readonly authentication: ServiceAuthenticationState | null;
  readonly input: JsonValue;
  // Absent from states written before deadlines travelled with the work: none.
  readonly deadline?: string | null;
}

export interface ProcessRunState {
  readonly id: string;
  readonly kind: RunKind;
  readonly language: ScriptLanguage | null;
  readonly process: JsonValue;
  // Absent from states written before deadlines travelled with the work: none.
  readonly deadline?: string | null;
}

export interface WorkflowErrorState {
  readonly type: string;
  readonly status: number;
  readonly instance: string;
  readonly title: string | null;
  readonly detail: string | null;
}

export interface FlowDirectiveState {
  readonly name: string;
  readonly pointer: readonly string[] | null;
}

export interface SubWorkflowRequestState {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly input: JsonValue;
  readonly awaited: boolean;
}

export interface DetachedWorkflowState {
  readonly namespace: string;
  readonly name: string;
  readonly versionId: string;
  readonly input: JsonValue;
}

export interface CloudEventState {
  readonly id: string;
  readonly source: string;
  readonly type: string;
  readonly time: string | null;
  readonly subject: string | null;
  readonly dataContentType: string | null;
  readonly dataSchema: string | null;
  readonly data: JsonValue;
  readonly extensions: JsonObject;
}

export interface OutcomeState {
  readonly output: JsonValue;
  readonly failure: WorkflowErrorState | null;
  readonly directive: FlowDirectiveState | null;
  readonly authorization: JsonObject | null;
  readonly emitted: CloudEventState | null;
  readonly detachedProcess: ProcessRunState | null;
  readonly detachedWorkflow: DetachedWorkflowState | null;
}

export interface CompletedEndingState {
  readonly kind: EndingKind.Completed;
  readonly output: JsonValue;
  readonly directive: FlowDirectiveState;
  readonly exported: boolean;
  readonly context: JsonValue;
  readonly body: OutcomeState;
}

export interface FaultedEndingState {
  readonly kind: EndingKind.Faulted;
  readonly failure: WorkflowErrorState;
}

export interface SkippedEndingState {
  readonly kind: EndingKind.Skipped;
  readonly output: JsonValue;
  readonly directive: FlowDirectiveState;
}

export type TaskEndingState =
  CompletedEndingState | FaultedEndingState | SkippedEndingState;

export interface SequenceState {
  readonly position: number;
  readonly variables: JsonObject;
}

export interface EntryStageState {
  readonly stage: TaskStage.Entry;
}

export interface BodyStageState {
  readonly stage: TaskStage.Body;
  readonly input: JsonValue;
  readonly deadline: string | null;
  readonly body: KindProgressState;
}

export interface OutputStageState {
  readonly stage: TaskStage.Output;
  readonly input: JsonValue;
  readonly deadline: string | null;
  readonly outcome: OutcomeState;
}

export interface ExportStageState {
  readonly stage: TaskStage.Export;
  readonly input: JsonValue;
  readonly deadline: string | null;
  readonly outcome: OutcomeState;
  readonly output: JsonValue;
}

export interface ExportCheckStageState {
  readonly stage: TaskStage.ExportCheck;
  readonly deadline: string | null;
  readonly outcome: OutcomeState;
  readonly output: JsonValue;
  readonly context: JsonValue;
  readonly exported: boolean;
}

export interface EndedStageState {
  readonly stage: TaskStage.Ended;
  readonly ending: TaskEndingState;
}

export type TaskProgressState =
  | EntryStageState
  | BodyStageState
  | OutputStageState
  | ExportStageState
  | ExportCheckStageState
  | EndedStageState;

export interface DefinitionProgressState {
  readonly kind: ProgressKind.Definition;
}

export interface CallingProgressState {
  readonly kind: ProgressKind.Calling;
  readonly call: ServiceCallState;
}

export interface RunningProgressState {
  readonly kind: ProgressKind.Running;
  readonly run: ProcessRunState;
}

export interface FunctionProgressState {
  readonly kind: ProgressKind.Function;
}

export interface SubWorkflowProgressState {
  readonly kind: ProgressKind.SubWorkflow;
  readonly request: SubWorkflowRequestState;
}

export interface DoProgressState {
  readonly kind: ProgressKind.Do;
  readonly sequence: SequenceState;
}

export interface ForIterationState {
  readonly items: readonly JsonValue[];
  readonly index: number;
  readonly data: JsonValue;
}

export interface ForCollectingProgressState {
  readonly kind: ProgressKind.ForCollecting;
}

export interface ForCheckingProgressState {
  readonly kind: ProgressKind.ForChecking;
  readonly iteration: ForIterationState;
}

export interface ForIteratingProgressState {
  readonly kind: ProgressKind.ForIterating;
  readonly iteration: ForIterationState;
  readonly sequence: SequenceState;
}

export interface ForkProgressState {
  readonly kind: ProgressKind.Fork;
  readonly outputs: readonly JsonValue[];
  readonly pending: readonly number[];
}

export interface SwitchProgressState {
  readonly kind: ProgressKind.Switch;
}

export interface AttemptState {
  readonly count: number;
  readonly firstStartedAt: string;
}

export interface TryProgressState {
  readonly kind: ProgressKind.Try;
  readonly attempt: AttemptState;
  readonly sequence: SequenceState;
}

export interface CatchProgressState {
  readonly kind: ProgressKind.Catch;
  readonly attempt: AttemptState;
  readonly error: WorkflowErrorState;
}

export interface RetryProgressState {
  readonly kind: ProgressKind.Retry;
  readonly attempt: AttemptState;
  readonly wakeAt: string;
}

export interface HandlerProgressState {
  readonly kind: ProgressKind.Handler;
  readonly sequence: SequenceState;
}

export type KindProgressState =
  | DefinitionProgressState
  | CallingProgressState
  | RunningProgressState
  | FunctionProgressState
  | SubWorkflowProgressState
  | DoProgressState
  | ForCollectingProgressState
  | ForCheckingProgressState
  | ForIteratingProgressState
  | ForkProgressState
  | SwitchProgressState
  | TryProgressState
  | CatchProgressState
  | RetryProgressState
  | HandlerProgressState;
