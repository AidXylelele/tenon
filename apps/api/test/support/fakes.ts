import { DraftRepository } from "../../src/application/automation/drafts/ports.js";
import type { Draft } from "../../src/domain/automation/drafts/draft.js";
import {
  InstanceEvents,
  InstanceRuns,
  WorkflowInstanceRepository,
} from "../../src/application/automation/instances/ports.js";
import { SecretRepository } from "../../src/application/automation/secrets/ports.js";
import type { Secret } from "../../src/domain/automation/secrets/secret.js";
import type {
  VersionPublication,
  WorkflowEvent,
  WorkflowProps,
} from "../../src/domain/automation/workflows/interfaces.js";
import {
  DefinitionCompiler,
  WorkflowEvents,
  WorkflowRepository,
} from "../../src/application/automation/workflows/ports.js";
import type {
  DefinitionProblem,
  DefinitionSource,
} from "../../src/application/automation/workflows/interfaces.js";
import {
  InstanceEventKind,
  Phase,
  TriggerKind,
} from "../../src/domain/automation/instances/enums.js";
import type {
  EffectAnswer,
  InstanceEvent,
  WorkflowInstanceProps,
} from "../../src/domain/automation/instances/interfaces.js";
import type { Run } from "../../src/domain/automation/instances/run.js";
import { WorkflowInstance } from "../../src/domain/automation/instances/workflow-instance.js";
import type { JsonObject } from "../../src/domain/automation/interfaces.js";
import { CheckedDefinition } from "../../src/domain/automation/workflows/checked-definition.js";
import { Workflow } from "../../src/domain/automation/workflows/workflow.js";
import { WorkflowName } from "../../src/domain/automation/workflows/workflow-name.js";
import type { Result } from "../../src/domain/interfaces.js";
import { UnitOfWork } from "../../src/application/unit-of-work.js";
import {
  AccountRepository,
  PasswordHasher,
  Sessions,
} from "../../src/application/identity/accounts/ports.js";
import {
  InvitationMailer,
  InvitationRepository,
} from "../../src/application/identity/invitations/ports.js";
import { UserRepository } from "../../src/application/identity/users/ports.js";
import type { Account } from "../../src/domain/identity/accounts/account.js";
import { InvitationStatus } from "../../src/domain/identity/invitations/enums.js";
import { StaleWriteError } from "../../src/domain/stale-write.error.js";
import type { Invitation } from "../../src/domain/identity/invitations/invitation.js";
import type { InvitationToken } from "../../src/domain/identity/invitations/invitation-token.js";
import type { User } from "../../src/domain/identity/users/user.js";

export class FakeUnitOfWork extends UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}

export class InMemoryUserRepository extends UserRepository {
  readonly users = new Map<string, User>();

  constructor(...users: User[]) {
    super();
    for (const user of users) this.users.set(user.id, user);
  }

  add(user: User): Promise<void> {
    this.users.set(user.id, user);
    return Promise.resolve();
  }

  find(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  findByEmail(email: string): Promise<User | null> {
    return Promise.resolve(
      this.all().find((user) => user.email === email) ?? null,
    );
  }

  private all(): User[] {
    return [...this.users.values()];
  }
}

export class InMemoryAccountRepository extends AccountRepository {
  readonly accounts = new Map<string, Account>();

  constructor(...accounts: Account[]) {
    super();
    for (const account of accounts) this.accounts.set(account.id, account);
  }

  save(account: Account): Promise<void> {
    this.accounts.set(account.id, account);
    return Promise.resolve();
  }

  findByEmail(email: string): Promise<Account | null> {
    return Promise.resolve(
      this.all().find((account) => account.identifier === email) ?? null,
    );
  }

  findByUserId(userId: string): Promise<Account | null> {
    return Promise.resolve(
      this.all().find((account) => account.userId === userId) ?? null,
    );
  }

  private all(): Account[] {
    return [...this.accounts.values()];
  }
}

export class InMemoryInvitationRepository extends InvitationRepository {
  readonly invitations = new Map<string, Invitation>();

  constructor(...invitations: Invitation[]) {
    super();
    for (const invitation of invitations) {
      this.invitations.set(invitation.id, invitation);
    }
  }

  save(invitation: Invitation): Promise<void> {
    this.invitations.set(invitation.id, invitation);
    return Promise.resolve();
  }

  find(id: string): Promise<Invitation | null> {
    return Promise.resolve(this.invitations.get(id) ?? null);
  }

  findByToken(token: InvitationToken): Promise<Invitation | null> {
    const invitation = this.all().find((item) => item.tokenHash === token.hash);
    return Promise.resolve(invitation ?? null);
  }

  findPendingByEmail(email: string): Promise<Invitation | null> {
    return Promise.resolve(
      this.all().find(
        (item) =>
          item.email === email && item.status === InvitationStatus.Pending,
      ) ?? null,
    );
  }

  private all(): Invitation[] {
    return [...this.invitations.values()];
  }
}

export class FakePasswordHasher extends PasswordHasher {
  hash(password: string): Promise<string> {
    return Promise.resolve(`hashed:${password}`);
  }

  verify(password: string, hash: string | null): Promise<boolean> {
    return Promise.resolve(hash === `hashed:${password}`);
  }
}

export interface SentInvitation {
  readonly invitation: Invitation;
  readonly token: InvitationToken;
  readonly inviterName: string;
}

export class RecordingInvitationMailer extends InvitationMailer {
  readonly sent: SentInvitation[] = [];

  sendInvitation(
    invitation: Invitation,
    token: InvitationToken,
    inviterName: string,
  ): Promise<void> {
    this.sent.push({ invitation, token, inviterName });
    return Promise.resolve();
  }
}

export class RecordingSessions extends Sessions {
  readonly ended: { userId: string; except: string | null }[] = [];

  endAll(userId: string, except: string | null): Promise<void> {
    this.ended.push({ userId, except });
    return Promise.resolve();
  }
}

export class StoredDrafts extends DraftRepository {
  readonly #drafts = new Map<string, Draft>();

  findByName(name: WorkflowName): Promise<Draft | null> {
    const key = `${name.namespace}/${name.name}`;
    return Promise.resolve(this.#drafts.get(key) ?? null);
  }

  save(draft: Draft): Promise<void> {
    const key = `${draft.name.namespace}/${draft.name.name}`;
    this.#drafts.set(key, draft);
    return Promise.resolve();
  }

  remove(draft: Draft): Promise<void> {
    const key = `${draft.name.namespace}/${draft.name.name}`;
    this.#drafts.delete(key);
    return Promise.resolve();
  }
}

export class FakeDefinitionCompiler extends DefinitionCompiler {
  readonly refused = new Map<string, readonly DefinitionProblem[]>();

  compile(
    authored: DefinitionSource,
  ): Promise<Result<CheckedDefinition, readonly DefinitionProblem[]>> {
    const document =
      typeof authored === "string"
        ? (JSON.parse(authored) as JsonObject)
        : authored;
    const header = document.document as Record<string, string>;
    const problems = this.refused.get(header.name ?? "");

    if (problems !== undefined)
      return Promise.resolve({ ok: false, failure: problems });

    const name = new WorkflowName(header.namespace ?? "", header.name ?? "");
    const digest = JSON.stringify(document);
    const definition = new CheckedDefinition({
      name,
      version: header.version ?? "",
      dsl: header.dsl ?? "",
      digest,
      document,
      imports: {},
      programFingerprint: digest,
      schedule: null,
      secrets: [],
    });
    return Promise.resolve({ ok: true, value: definition });
  }
}

function instanceRow(
  instance: WorkflowInstance,
  version: number,
): WorkflowInstanceProps {
  return {
    id: instance.id,
    workflowId: instance.workflowId,
    versionId: instance.versionId,
    trigger: instance.trigger,
    starterId: instance.starterId,
    originId: instance.originId,
    originEffectId: instance.originEffectId,
    input: instance.input,
    phase: instance.phase,
    output: instance.output,
    error: instance.error,
    createdAt: instance.createdAt,
    startedAt: instance.startedAt,
    endedAt: instance.endedAt,
    cancelReason: instance.cancelReason,
    run: instance.run,
    test: instance.test,
    version,
  };
}

export class StoredWorkflowInstanceRepository extends WorkflowInstanceRepository {
  readonly rows = new Map<string, WorkflowInstanceProps>();
  saves = 0;

  constructor(...instances: WorkflowInstance[]) {
    super();
    for (const instance of instances) this.put(instance);
  }

  put(instance: WorkflowInstance): void {
    const row = instanceRow(instance, instance.version);
    this.rows.set(instance.id, row);
  }

  find(id: string): Promise<WorkflowInstance | null> {
    const row = this.rows.get(id);

    if (row === undefined) return Promise.resolve(null);

    return Promise.resolve(new WorkflowInstance(row));
  }

  findChild(
    parentId: string,
    effectId: string,
  ): Promise<WorkflowInstance | null> {
    const row = [...this.rows.values()].find(
      (item) => item.originId === parentId && item.originEffectId === effectId,
    );

    if (row === undefined) return Promise.resolve(null);

    return Promise.resolve(new WorkflowInstance(row));
  }

  findAwaitedChildren(parentId: string): Promise<WorkflowInstance[]> {
    const rows = [...this.rows.values()].filter(
      (row) =>
        row.originId === parentId &&
        row.trigger === TriggerKind.Parent &&
        row.endedAt === null,
    );
    return Promise.resolve(rows.map((row) => new WorkflowInstance(row)));
  }

  findEndedChildren(parent: WorkflowInstance): Promise<WorkflowInstance[]> {
    const awaited = parent.awaited.map((effect) => effect.id);
    const rows = [...this.rows.values()].filter(
      (row) =>
        row.originId === parent.id &&
        row.trigger === TriggerKind.Parent &&
        row.originEffectId !== null &&
        awaited.includes(row.originEffectId) &&
        row.endedAt !== null,
    );
    return Promise.resolve(rows.map((row) => new WorkflowInstance(row)));
  }

  hasUnendedScheduled(workflowId: string): Promise<boolean> {
    const rows = [...this.rows.values()];
    return Promise.resolve(
      rows.some(
        (row) =>
          row.workflowId === workflowId &&
          row.trigger === TriggerKind.Schedule &&
          row.endedAt === null,
      ),
    );
  }

  save(instance: WorkflowInstance): Promise<void> {
    const stored = this.rows.get(instance.id);
    const stale = stored !== undefined && stored.version !== instance.version;

    if (stale) throw new StaleWriteError();

    const row = instanceRow(instance, instance.version + 1);
    this.rows.set(instance.id, row);
    this.saves += 1;
    instance.clearLifecycle();
    return Promise.resolve();
  }

  remove(instance: WorkflowInstance): Promise<void> {
    this.rows.delete(instance.id);
    return Promise.resolve();
  }

  phaseOf(id: string): Phase | undefined {
    return this.rows.get(id)?.phase;
  }
}

type WorkflowRoot = Omit<WorkflowProps, "versions">;

interface StoredVersion {
  readonly workflowId: string;
  readonly publication: VersionPublication;
}

function workflowRow(workflow: Workflow, version: number): WorkflowRoot {
  return {
    id: workflow.id,
    name: workflow.name,
    status: workflow.status,
    on: workflow.on,
    currentVersionId: workflow.currentVersionId,
    archivedAt: workflow.archivedAt,
    arming: workflow.arming,
    scheduledSince: workflow.scheduledSince,
    version,
  };
}

export class StoredWorkflowRepository extends WorkflowRepository {
  readonly rows = new Map<string, WorkflowRoot>();
  readonly versions = new Map<string, StoredVersion>();
  saves = 0;

  findByName(name: WorkflowName): Promise<Workflow | null> {
    const row = [...this.rows.values()].find((item) => item.name.equals(name));

    if (row === undefined) return Promise.resolve(null);

    return Promise.resolve(this.#loaded(row));
  }

  findById(id: string): Promise<Workflow | null> {
    const row = this.rows.get(id);

    if (row === undefined) return Promise.resolve(null);

    return Promise.resolve(this.#loaded(row));
  }

  save(workflow: Workflow): Promise<void> {
    const stored = this.rows.get(workflow.id);
    const stale = stored !== undefined && stored.version !== workflow.version;
    const taken = [...this.rows.values()].some(
      (row) => row.id !== workflow.id && row.name.equals(workflow.name),
    );

    if (stale || taken) throw new StaleWriteError();

    const row = workflowRow(workflow, workflow.version + 1);
    this.rows.set(workflow.id, row);

    for (const publication of workflow.publications)
      this.versions.set(publication.version.id, {
        workflowId: workflow.id,
        publication,
      });

    workflow.clearPublications();
    this.saves += 1;
    return Promise.resolve();
  }

  #loaded(row: WorkflowRoot): Workflow {
    const versions = [...this.versions.values()]
      .filter((stored) => stored.workflowId === row.id)
      .map((stored) => stored.publication.version);
    return new Workflow({ ...row, versions });
  }
}

export interface StartedRun {
  readonly instance: WorkflowInstance;
  readonly stored: boolean;
}

export class RecordingInstanceEvents extends InstanceEvents {
  readonly started: StartedRun[] = [];
  readonly dispatched: InstanceEvent[] = [];
  readonly calls: string[] = [];

  constructor(private readonly instances: StoredWorkflowInstanceRepository) {
    super();
  }

  dispatch(instance: WorkflowInstance): Promise<void> {
    const stored = this.instances.rows.has(instance.id);
    const starts = instance.events.some(
      (event) => event.kind === InstanceEventKind.Started,
    );

    if (starts) this.started.push({ instance, stored });

    this.calls.push(instance.id);

    for (const event of instance.events) this.dispatched.push(event);

    instance.clearEvents();
    return Promise.resolve();
  }

  kindsOf(instanceId: string): readonly InstanceEventKind[] {
    return this.dispatched
      .filter((event) => event.instanceId === instanceId)
      .map((event) => event.kind);
  }
}

export interface RecordedAnswer {
  readonly instanceId: string;
  readonly answer: EffectAnswer;
}

export interface RecordedProcess {
  readonly instanceId: string;
  readonly effectId: string;
  readonly request: JsonObject;
}

export class RecordingInstanceRuns extends InstanceRuns {
  readonly responded: RecordedAnswer[] = [];
  readonly detached: RecordedProcess[] = [];
  readonly received: string[] = [];
  readonly failed: string[] = [];

  respond(instance: WorkflowInstance, answer: EffectAnswer): Promise<void> {
    this.responded.push({ instanceId: instance.id, answer });
    return Promise.resolve();
  }

  detach(
    instance: WorkflowInstance,
    effectId: string,
    request: JsonObject,
  ): Promise<void> {
    this.detached.push({ instanceId: instance.id, effectId, request });
    return Promise.resolve();
  }

  receive(instance: WorkflowInstance): Promise<void> {
    this.received.push(instance.id);
    return Promise.resolve();
  }

  fail(instance: WorkflowInstance): Promise<void> {
    this.failed.push(instance.id);
    return Promise.resolve();
  }
}

export const T0 = new Date("2026-11-03T10:00:00.000Z");

export interface InstanceOverrides {
  readonly id?: string;
  readonly workflowId?: string;
  readonly versionId?: string;
  readonly trigger?: TriggerKind;
  readonly originId?: string | null;
  readonly originEffectId?: string | null;
  readonly run?: Run | null;
  readonly input?: WorkflowInstanceProps["input"];
  readonly startedAt?: Date | null;
  readonly endedAt?: Date | null;
  readonly test?: boolean;
  readonly version?: number;
}

const ENDED = [Phase.Completed, Phase.Faulted, Phase.Cancelled];

export function anInstanceIn(
  phase: Phase,
  overrides: InstanceOverrides = {},
): WorkflowInstance {
  const ended = ENDED.includes(phase);
  const begun = phase !== Phase.Pending;
  const startedAt = begun ? T0 : null;
  const endedAt = ended ? T0 : null;
  return new WorkflowInstance({
    id: overrides.id ?? "instance-1",
    workflowId: overrides.workflowId ?? "workflow-1",
    versionId: overrides.versionId ?? "version-1",
    trigger: overrides.trigger ?? TriggerKind.Manual,
    starterId: "author-1",
    originId: overrides.originId ?? null,
    originEffectId: overrides.originEffectId ?? null,
    input: overrides.input ?? { amount: 1 },
    phase,
    output: null,
    error: null,
    createdAt: T0,
    startedAt:
      overrides.startedAt === undefined ? startedAt : overrides.startedAt,
    endedAt: overrides.endedAt === undefined ? endedAt : overrides.endedAt,
    cancelReason: null,
    run: overrides.run ?? null,
    test: overrides.test ?? false,
    version: overrides.version ?? 1,
  });
}

export class RecordingWorkflowEvents extends WorkflowEvents {
  readonly dispatched: WorkflowEvent[] = [];
  readonly calls: string[] = [];

  dispatch(workflow: Workflow): Promise<void> {
    for (const event of workflow.events) this.dispatched.push(event);

    this.calls.push(workflow.id);
    workflow.clearEvents();
    return Promise.resolve();
  }
}

export class StoredSecrets extends SecretRepository {
  constructor(private readonly secrets: readonly Secret[] = []) {
    super();
  }

  find(ownerId: string, name: string): Promise<Secret | null> {
    const found = this.secrets.find(
      (secret) => secret.ownerId === ownerId && secret.name === name,
    );
    return Promise.resolve(found ?? null);
  }

  findOwnedBy(ownerId: string): Promise<Secret[]> {
    return Promise.resolve(
      this.secrets.filter((secret) => secret.ownerId === ownerId),
    );
  }

  findDeclared(): Promise<Secret[]> {
    return Promise.resolve([]);
  }

  save(): Promise<void> {
    return Promise.resolve(Promise.resolve());
  }

  remove(): Promise<void> {
    return Promise.resolve(Promise.resolve());
  }
}
