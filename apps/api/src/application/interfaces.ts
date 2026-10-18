import type { Account } from '../domain/account.js';
import type {
  AccountType,
  ErrorKind,
  Role,
  RunMode,
  RunStatus,
  StepStatus,
  TriggerType,
} from '../domain/enums.js';
import type { Graph } from '../domain/graph.js';
import type { Invitation } from '../domain/invitation.js';
import type { InvitationToken } from '../domain/invitation-token.js';
import type {
  ConnectionProps,
  EncryptedSecret,
  GraphProps,
  NodeFailure,
  NodeInput,
  NodeParameters,
  NodePosition,
  NodeRename,
  NodeSettings,
  Problem,
  RetrySetting,
  RunError,
  StepOutput,
  WorkflowSettings,
} from '../domain/interfaces.js';
import type { Node } from '../domain/node.js';
import type { Release } from '../domain/release.js';
import type { Run } from '../domain/run.js';
import type { Workflow } from '../domain/workflow.js';
import type { User } from '../domain/user.js';
import type { WebhookEndpoint } from '../domain/webhook-endpoint.js';

export interface AuthenticateUserCommand {
  readonly email: string;
  readonly password: string;
}

export interface ChangePasswordCommand {
  readonly userId: string;
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface ResetPasswordCommand {
  readonly userId: string;
  readonly passwordHash: string;
}

export interface InviteUserCommand {
  readonly email: string;
  readonly role: Role;
  readonly invitedBy: string;
  readonly inviterName: string;
}

export interface AcceptInvitationCommand {
  readonly token: string;
  readonly name: string;
  readonly password: string;
}

export interface AcceptedInvitation {
  readonly invitation: Invitation;
  readonly user: User;
}

export interface PendingInvitation {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export interface InvitationEmail {
  readonly to: string;
  readonly token: InvitationToken;
  readonly inviterName: string;
  readonly role: Role;
  readonly expiresAt: Date;
}

export abstract class UserRepository {
  abstract add(user: User): Promise<void>;
  abstract getById(id: string): Promise<User>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findActiveById(id: string): Promise<User | null>;
  abstract findActiveByEmail(email: string): Promise<User | null>;
}

export abstract class AccountRepository {
  abstract add(account: Account): Promise<void>;
  abstract update(account: Account): Promise<void>;
  abstract findByIdentifier(
    type: AccountType,
    identifier: string,
  ): Promise<Account | null>;
  abstract findByUserId(
    userId: string,
    type: AccountType,
  ): Promise<Account | null>;
}

export abstract class InvitationRepository {
  abstract add(invitation: Invitation): Promise<void>;
  abstract update(invitation: Invitation): Promise<void>;
  abstract getById(id: string): Promise<Invitation>;
  abstract getByToken(token: InvitationToken): Promise<Invitation>;
  abstract findPendingByEmail(email: string): Promise<Invitation | null>;
}

export abstract class InvitationQueries {
  abstract listPending(): Promise<PendingInvitation[]>;
}

export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  abstract verify(password: string, hash: string | null): Promise<boolean>;
}

export abstract class Mailing {
  abstract sendInvitation(email: InvitationEmail): Promise<void>;
}

export type Item = Readonly<Record<string, unknown>>;

export type FieldType =
  'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

export interface FieldShape {
  readonly path: string;
  readonly type: FieldType;
}

export interface NodeTypeFacts {
  readonly trigger: TriggerType | null;
  readonly defaultSettings: NodeSettings;
  readonly credentialTypes: readonly string[];
}

export interface NodeTypeEntry {
  readonly id: string;
  readonly version: number;
  readonly kind: string;
  readonly trigger: TriggerType | null;
  readonly category: string;
  readonly displayName: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[] | { readonly fromParameter: string };
  readonly credentialTypes: readonly string[];
  readonly defaultSettings: NodeSettings;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type WebhookAuthentication = 'token' | 'signature';

export interface WebhookSettings {
  readonly methods: readonly HttpMethod[];
  readonly authentication: WebhookAuthentication;
}

export type RecurrenceKind = 'cron' | 'rrule';

export interface Recurrence {
  readonly kind: RecurrenceKind;
  readonly expression: string;
  readonly timezone: string | null;
}

export abstract class NodeTypeCatalog {
  abstract describe(type: string, version: number): NodeTypeFacts | null;
  abstract problemsOf(node: Node, graph: Graph): Problem[];
  abstract list(): NodeTypeEntry[];
  abstract webhookOf(node: Node): WebhookSettings | null;
  abstract schedulesOf(node: Node): Recurrence[];
}

export abstract class FormulaEngine {
  abstract renameNodes(
    parameters: NodeParameters,
    renames: readonly NodeRename[],
  ): NodeParameters;
}

export interface DraftNodeSettings {
  readonly alwaysOutputData?: boolean;
  readonly executeOnce?: boolean;
  readonly retry?: Partial<RetrySetting>;
  readonly onError?: NodeSettings['onError'];
}

export interface DraftNode {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly typeVersion: number;
  readonly parameters: NodeParameters;
  readonly credentialId: string | null;
  readonly settings: DraftNodeSettings;
  readonly position: NodePosition;
  readonly note: string | null;
  readonly disabled: boolean;
}

export interface DraftGraph {
  readonly nodes: readonly DraftNode[];
  readonly connections: readonly ConnectionProps[];
}

export interface CreateWorkflowCommand {
  readonly actor: User;
  readonly name: string;
}

export interface WorkflowCommand {
  readonly actor: User;
  readonly workflowId: string;
}

export interface RenameWorkflowCommand extends WorkflowCommand {
  readonly name: string;
}

export interface SaveDraftCommand extends WorkflowCommand {
  readonly revision: number;
  readonly graph: DraftGraph;
  readonly settings: WorkflowSettings;
}

export interface SavedDraft {
  readonly workflow: Workflow;
  readonly problems: readonly Problem[];
}

export interface PinSampleCommand extends WorkflowCommand {
  readonly nodeId: string;
  readonly items: readonly Item[];
}

export interface UnpinSampleCommand extends WorkflowCommand {
  readonly nodeId: string;
}

export interface PublishReleaseCommand extends WorkflowCommand {
  readonly revision: number;
}

export interface DuplicateWorkflowCommand extends WorkflowCommand {
  readonly name: string | null;
}

export interface TransferWorkflowCommand extends WorkflowCommand {
  readonly ownerId: string;
}

export interface WorkflowQuery {
  readonly actor: User;
  readonly workflowId: string;
}

export interface ReleaseQuery extends WorkflowQuery {
  readonly number: number;
}

export interface UserReference {
  readonly id: string;
  readonly name: string;
}

export interface WorkflowSummary {
  readonly id: string;
  readonly name: string;
  readonly owner: UserReference;
  readonly archived: boolean;
  readonly latestRelease: number;
  readonly activeRelease: number | null;
  readonly updatedAt: Date;
}

export interface NodeSampleView {
  readonly nodeId: string;
  readonly pinned: boolean;
  readonly fields: readonly FieldShape[];
}

export interface WorkflowView extends WorkflowSummary {
  readonly revision: number;
  readonly graph: GraphProps;
  readonly settings: WorkflowSettings;
  readonly samples: readonly NodeSampleView[];
}

export interface WorkflowDetails {
  readonly workflow: WorkflowView;
  readonly problems: readonly Problem[];
  readonly canManage: boolean;
}

export interface WorkflowFilter {
  readonly search: string | null;
  readonly ownerId: string | null;
  readonly archived: boolean;
  readonly cursor: string | null;
  readonly limit: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface ReleaseSummary {
  readonly number: number;
  readonly publishedAt: Date;
  readonly publishedBy: UserReference;
}

export interface ReleaseView extends ReleaseSummary {
  readonly graph: GraphProps;
  readonly settings: WorkflowSettings;
}

export abstract class WorkflowRepository {
  abstract add(workflow: Workflow): Promise<void>;
  abstract update(workflow: Workflow): Promise<void>;
  abstract getById(id: string): Promise<Workflow>;
}

export abstract class ReleaseRepository {
  abstract add(release: Release): Promise<void>;
  abstract get(workflowId: string, number: number): Promise<Release>;
}

export abstract class NodeSamples {
  abstract pin(
    workflowId: string,
    nodeId: string,
    items: readonly Item[],
  ): Promise<void>;
  abstract unpin(workflowId: string, nodeId: string): Promise<void>;
  abstract pinned(workflowId: string, nodeId: string): Promise<readonly Item[]>;
  abstract recordFields(
    workflowId: string,
    nodeId: string,
    fields: readonly FieldShape[],
  ): Promise<void>;
}

export abstract class WorkflowQueries {
  abstract list(filter: WorkflowFilter): Promise<Page<WorkflowSummary>>;
  abstract get(id: string): Promise<WorkflowView>;
  abstract releases(workflowId: string): Promise<ReleaseSummary[]>;
  abstract release(workflowId: string, number: number): Promise<ReleaseView>;
  abstract activeIds(): Promise<string[]>;
}

export interface StartTestRunCommand extends WorkflowCommand {
  readonly revision: number;
  readonly triggerNodeId: string;
  readonly items: readonly Item[];
}

export interface StartManualRunCommand extends WorkflowCommand {
  readonly releaseNumber: number;
  readonly triggerNodeId: string;
  readonly items: readonly Item[];
}

export interface CancelRunCommand {
  readonly actor: User;
  readonly runId: string;
}

export interface OutputTarget {
  readonly runId: string;
  readonly nodeId: string;
  readonly attempt: number;
  readonly port: string;
}

export interface Assignment {
  readonly run: Run;
  readonly input: NodeInput;
  readonly attempt: number;
}

export interface NodeOutcome {
  readonly outputs: readonly StepOutput[];
  readonly failure: NodeFailure | null;
  readonly fields: readonly FieldShape[];
}

export interface NodeAttempt {
  readonly outcome: NodeOutcome;
  readonly retryInMs: number | null;
}

export interface RunSummary {
  readonly id: string;
  readonly workflowId: string;
  readonly status: RunStatus;
  readonly mode: RunMode;
  readonly trigger: TriggerType;
  readonly releaseNumber: number | null;
  readonly queuedAt: Date;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly error: RunError | null;
}

export interface StepView {
  readonly nodeId: string;
  readonly status: StepStatus;
  readonly attempts: number;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly outputs: readonly StepOutput[];
  readonly error: NodeFailure | null;
}

export interface RunView extends RunSummary {
  readonly steps: readonly StepView[];
  readonly version: number;
}

export interface RunFilter {
  readonly status: RunStatus | null;
  readonly cursor: string | null;
  readonly limit: number;
}

export interface StepOutputQuery {
  readonly runId: string;
  readonly nodeId: string;
  readonly port: string;
  readonly offset: number;
  readonly limit: number;
}

export interface StepOutputPage {
  readonly items: readonly Item[];
  readonly total: number;
  readonly offset: number;
}

export interface EngineEnd {
  readonly kind: ErrorKind;
  readonly message: string;
}

export abstract class ArtifactStore {
  abstract write(
    target: OutputTarget,
    items: readonly Item[],
  ): Promise<StepOutput>;
  abstract read(
    outputs: readonly StepOutput[],
    offset: number,
    limit: number,
  ): Promise<Item[]>;
  abstract readAll(outputs: readonly StepOutput[]): Promise<Item[]>;
}

export abstract class NodeExecutor {
  abstract execute(assignment: Assignment): Promise<NodeOutcome>;
}

export abstract class RunRepository {
  abstract add(run: Run): Promise<void>;
  abstract update(run: Run): Promise<void>;
  abstract getById(id: string): Promise<Run>;
  abstract findById(id: string): Promise<Run | null>;
}

export abstract class RunQueries {
  abstract list(
    workflowId: string,
    filter: RunFilter,
  ): Promise<Page<RunSummary>>;
  abstract get(id: string): Promise<RunView>;
  abstract unfinishedBefore(moment: Date, limit: number): Promise<string[]>;
}

export abstract class SecretCipher {
  abstract encrypt(plain: string): EncryptedSecret;
  abstract decrypt(secret: EncryptedSecret): string | null;
}

export abstract class WebhookEndpointRepository {
  abstract add(endpoint: WebhookEndpoint): Promise<void>;
  abstract update(endpoint: WebhookEndpoint): Promise<void>;
  abstract findById(id: string): Promise<WebhookEndpoint | null>;
  abstract findByNode(
    workflowId: string,
    nodeId: string,
  ): Promise<WebhookEndpoint | null>;
  abstract listByWorkflow(workflowId: string): Promise<WebhookEndpoint[]>;
}

export interface WebhookCommand extends WorkflowCommand {
  readonly nodeId: string;
}

export interface WebhookEndpointView {
  readonly endpointId: string;
  readonly nodeId: string;
  readonly secret: string | null;
  readonly settings: WebhookSettings | null;
}

export interface ActivateReleaseCommand extends WorkflowCommand {
  readonly releaseNumber: number;
}

export interface ActiveSchedule {
  readonly workflowId: string;
  readonly releaseNumber: number;
  readonly nodeId: string;
  readonly rule: number;
  readonly kind: RecurrenceKind;
  readonly expression: string;
  readonly timezone: string;
}

export interface StartScheduledRunCommand {
  readonly workflowId: string;
  readonly releaseNumber: number;
  readonly nodeId: string;
  readonly occurrence: string;
  readonly at: Date;
}

export interface ResolvedWebhook {
  readonly endpointId: string;
  readonly workflowId: string;
  readonly releaseNumber: number;
  readonly nodeId: string;
  readonly secret: string;
  readonly settings: WebhookSettings;
}

export interface WebhookRequest {
  readonly method: string;
  readonly headers: Readonly<Record<string, string | readonly string[]>>;
  readonly query: Readonly<Record<string, unknown>>;
  readonly body: unknown;
}

export interface StartWebhookRunCommand {
  readonly endpointId: string;
  readonly workflowId: string;
  readonly releaseNumber: number;
  readonly nodeId: string;
  readonly deliveryId: string | null;
  readonly request: WebhookRequest;
}
