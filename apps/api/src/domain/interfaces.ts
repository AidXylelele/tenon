import type {
  AccountType,
  ErrorKind,
  GraphFaultCode,
  InvitationStatus,
  OnError,
  ProblemCode,
  Role,
  RunMode,
  RunStatus,
  StepStatus,
  TriggerType,
  UserStatus,
} from './enums.js';
import type { Graph } from './graph.js';
import type { InvitationToken } from './invitation-token.js';
import type { Node } from './node.js';

export interface UserProps {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly status: UserStatus;
  readonly createdAt: Date;
}

export interface NewUser {
  readonly email: string;
  readonly name: string;
  readonly role: Role;
}

export interface AccountProps {
  readonly id: string;
  readonly userId: string;
  readonly type: AccountType;
  readonly identifier: string;
  readonly passwordHash: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface InvitationProps {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly tokenHash: string;
  readonly status: InvitationStatus;
  readonly expiresAt: Date;
  readonly invitedBy: string;
  readonly acceptedAt: Date | null;
  readonly acceptedUserId: string | null;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
  readonly version: number;
}

export interface NewInvitation {
  readonly email: string;
  readonly role: Role;
  readonly invitedBy: string;
  readonly token: InvitationToken;
}

export interface RetrySetting {
  readonly attempts: number;
  readonly waitMs: number;
}

export interface NodeSettings {
  readonly alwaysOutputData: boolean;
  readonly executeOnce: boolean;
  readonly retry: RetrySetting;
  readonly onError: OnError;
}

export interface NodePosition {
  readonly x: number;
  readonly y: number;
}

export type NodeParameters = Readonly<Record<string, unknown>>;

export interface NodeProps {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly typeVersion: number;
  readonly trigger: TriggerType | null;
  readonly parameters: NodeParameters;
  readonly credentialId: string | null;
  readonly settings: NodeSettings;
  readonly position: NodePosition;
  readonly note: string | null;
  readonly disabled: boolean;
}

export interface ConnectionProps {
  readonly from: string;
  readonly output: string;
  readonly to: string;
  readonly input: string;
}

export interface GraphProps {
  readonly nodes: readonly NodeProps[];
  readonly connections: readonly ConnectionProps[];
}

export interface GraphFault {
  readonly code: GraphFaultCode;
  readonly nodeId: string | null;
  readonly message: string;
}

export interface NodeRename {
  readonly from: string;
  readonly to: string;
}

export interface Problem {
  readonly nodeId: string | null;
  readonly parameter: string | null;
  readonly code: ProblemCode;
  readonly message: string;
}

export interface NodeFailure {
  readonly kind: ErrorKind;
  readonly message: string;
  readonly parameter: string | null;
  readonly item: number | null;
  readonly typeUnavailable: boolean;
}

export interface WorkflowSettings {
  readonly timezone: string;
  readonly runTimeoutMs: number;
  readonly errorWorkflowId: string | null;
}

export interface WorkflowProps {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly graph: Graph;
  readonly settings: WorkflowSettings;
  readonly revision: number;
  readonly pinnedNodeIds: readonly string[];
  readonly latestRelease: number;
  readonly activeRelease: number | null;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface NewWorkflow {
  readonly name: string;
  readonly ownerId: string;
}

export interface ActivationChanged {
  readonly workflowId: string;
}

export interface ReleaseProps {
  readonly workflowId: string;
  readonly number: number;
  readonly graph: Graph;
  readonly settings: WorkflowSettings;
  readonly publishedAt: Date;
  readonly publishedBy: string;
}

export interface StepOutput {
  readonly port: string;
  readonly items: number;
  readonly bytes: number;
  readonly key: string;
  readonly chunkStarts: readonly number[];
}

export interface PinnedOutput {
  readonly nodeId: string;
  readonly outputs: readonly StepOutput[];
}

export interface RunTrigger {
  readonly type: TriggerType;
  readonly nodeId: string;
  readonly key: string | null;
}

export interface RunError {
  readonly nodeId: string | null;
  readonly kind: ErrorKind;
  readonly message: string;
}

export interface RunLimits {
  readonly runBytes: number;
}

export interface InputPort {
  readonly port: string;
  readonly outputs: readonly StepOutput[];
}

export interface UpstreamOutput {
  readonly nodeId: string;
  readonly name: string;
  readonly outputs: readonly StepOutput[];
}

export interface NodeInput {
  readonly node: Node;
  readonly ports: readonly InputPort[];
  readonly upstream: readonly UpstreamOutput[];
  readonly firstItemOnly: boolean;
  readonly emptyItemWhenSilent: boolean;
}

export interface StepProps {
  readonly nodeId: string;
  readonly status: StepStatus;
  readonly attempts: number;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly outputs: readonly StepOutput[];
  readonly error: NodeFailure | null;
}

export interface RunProps {
  readonly id: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly releaseNumber: number | null;
  readonly mode: RunMode;
  readonly trigger: RunTrigger;
  readonly graph: Graph;
  readonly actingUserId: string;
  readonly timeoutMs: number;
  readonly timezone: string;
  readonly input: readonly StepOutput[];
  readonly pins: readonly PinnedOutput[];
  readonly status: RunStatus;
  readonly error: RunError | null;
  readonly steps: readonly StepProps[];
  readonly queuedAt: Date;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly version: number;
}

export interface NewRun {
  readonly id: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly releaseNumber: number | null;
  readonly mode: RunMode;
  readonly trigger: RunTrigger;
  readonly graph: Graph;
  readonly actingUserId: string;
  readonly timeoutMs: number;
  readonly timezone: string;
  readonly input: readonly StepOutput[];
  readonly pins: readonly PinnedOutput[];
}

export interface NewTestRun {
  readonly runId: string;
  readonly revision: number;
  readonly triggerNodeId: string;
  readonly problems: readonly Problem[];
  readonly input: readonly StepOutput[];
  readonly pins: readonly PinnedOutput[];
}

export interface NewReleaseRun {
  readonly runId: string;
  readonly triggerNodeId: string;
  readonly input: readonly StepOutput[];
}

export interface NewTriggeredRun {
  readonly runId: string;
  readonly trigger: RunTrigger;
  readonly input: readonly StepOutput[];
}

export interface EncryptedSecret {
  readonly ciphertext: string;
  readonly keyVersion: string;
}

export interface WebhookEndpointProps {
  readonly id: string;
  readonly workflowId: string;
  readonly nodeId: string;
  readonly secret: EncryptedSecret;
  readonly createdAt: Date;
  readonly rotatedAt: Date | null;
  readonly version: number;
}
