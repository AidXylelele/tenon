import type { TransactionHost } from '@nestjs-cls/transactional';
import type {
  DefinitionChecker,
  DefinitionProblem,
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../../src/application/automation/workflows/ports.js';
import type { JsonObject } from '../../src/domain/automation/json.js';
import { CheckedDefinition } from '../../src/domain/automation/workflows/checked-definition.js';
import type { Workflow } from '../../src/domain/automation/workflows/workflow.js';
import { WorkflowName } from '../../src/domain/automation/workflows/workflow-name.js';
import type { WorkflowVersion } from '../../src/domain/automation/workflows/workflow-version.js';
import type { Result } from '../../src/domain/result.js';
import type {
  AccountRepository,
  InvitationRepository,
  Mailing,
  PasswordHasher,
  Sessions,
  UserRepository,
} from '../../src/application/identity/ports.js';
import type { Account } from '../../src/domain/identity/account.js';
import {
  AccountType,
  InvitationStatus,
} from '../../src/domain/identity/enums.js';
import {
  InvitationNotFoundError,
  UserNotFoundError,
} from '../../src/domain/errors.js';
import type { Invitation } from '../../src/domain/identity/invitation.js';
import type { InvitationToken } from '../../src/domain/identity/invitation-token.js';
import type { User } from '../../src/domain/identity/user.js';

export class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, User>();

  constructor(...users: User[]) {
    for (const user of users) this.users.set(user.id, user);
  }

  async add(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async getById(id: string): Promise<User> {
    const user = this.users.get(id);

    if (!user) throw new UserNotFoundError();

    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.all().find((user) => user.email === email) ?? null;
  }

  private all(): User[] {
    return [...this.users.values()];
  }
}

export class InMemoryAccountRepository implements AccountRepository {
  readonly accounts = new Map<string, Account>();

  constructor(...accounts: Account[]) {
    for (const account of accounts) this.accounts.set(account.id, account);
  }

  async save(account: Account): Promise<void> {
    this.accounts.set(account.id, account);
  }

  async findByEmail(email: string): Promise<Account | null> {
    return (
      this.all().find(
        (account) =>
          account.type === AccountType.Password && account.identifier === email,
      ) ?? null
    );
  }

  async findByUserId(
    userId: string,
    type: AccountType,
  ): Promise<Account | null> {
    return (
      this.all().find(
        (account) => account.userId === userId && account.type === type,
      ) ?? null
    );
  }

  private all(): Account[] {
    return [...this.accounts.values()];
  }
}

export class InMemoryInvitationRepository implements InvitationRepository {
  readonly invitations = new Map<string, Invitation>();

  constructor(...invitations: Invitation[]) {
    for (const invitation of invitations) {
      this.invitations.set(invitation.id, invitation);
    }
  }

  async save(invitation: Invitation): Promise<void> {
    this.invitations.set(invitation.id, invitation);
  }

  async getById(id: string): Promise<Invitation> {
    const invitation = this.invitations.get(id);

    if (!invitation) throw new InvitationNotFoundError();

    return invitation;
  }

  async getByToken(token: InvitationToken): Promise<Invitation> {
    const invitation = this.all().find((item) => item.tokenHash === token.hash);

    if (!invitation) throw new InvitationNotFoundError();

    return invitation;
  }

  async findPendingByEmail(email: string): Promise<Invitation | null> {
    return (
      this.all().find(
        (item) =>
          item.email === email && item.status === InvitationStatus.Pending,
      ) ?? null
    );
  }

  private all(): Invitation[] {
    return [...this.invitations.values()];
  }
}

export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed:${password}`;
  }

  async verify(password: string, hash: string | null): Promise<boolean> {
    return hash === `hashed:${password}`;
  }
}

export interface SentInvitation {
  readonly invitation: Invitation;
  readonly token: InvitationToken;
  readonly inviterName: string;
}

export interface SentRecoveryLink {
  readonly to: string;
  readonly link: string;
  readonly expiresAt: Date;
}

export class RecordingMailing implements Mailing {
  readonly sent: SentInvitation[] = [];
  readonly resets: SentRecoveryLink[] = [];

  async sendInvitation(
    invitation: Invitation,
    token: InvitationToken,
    inviterName: string,
  ): Promise<void> {
    this.sent.push({ invitation, token, inviterName });
  }

  async sendPasswordReset(
    to: string,
    link: string,
    expiresAt: Date,
  ): Promise<void> {
    this.resets.push({ to, link, expiresAt });
  }
}

export class RecordingSessions implements Sessions {
  readonly ended: { userId: string; except: string | null }[] = [];

  async endAll(userId: string, except: string | null): Promise<void> {
    this.ended.push({ userId, except });
  }
}

// Accepts any document with a `document` header, or refuses the ones it was told to.
export class FakeDefinitionChecker implements DefinitionChecker {
  readonly refused = new Map<string, DefinitionProblem>();

  async check(
    document: JsonObject,
  ): Promise<Result<CheckedDefinition, DefinitionProblem>> {
    const header = document.document as Record<string, string>;
    const problem = this.refused.get(header.name ?? '');

    if (problem !== undefined) return { ok: false, failure: problem };

    const name = new WorkflowName(header.namespace ?? '', header.name ?? '');
    const fingerprint = JSON.stringify(document);
    const definition = new CheckedDefinition({
      name,
      version: header.version ?? '',
      dsl: header.dsl ?? '',
      fingerprint,
      document,
    });
    return { ok: true, value: definition };
  }
}

export class InMemoryWorkflowRepository implements WorkflowRepository {
  readonly workflows = new Map<string, Workflow>();

  async findByName(name: WorkflowName): Promise<Workflow | null> {
    const found = [...this.workflows.values()].find((workflow) =>
      workflow.name.equals(name),
    );
    return found ?? null;
  }

  async findById(id: string): Promise<Workflow | null> {
    return this.workflows.get(id) ?? null;
  }

  async save(workflow: Workflow): Promise<void> {
    this.workflows.set(workflow.id, workflow);
  }
}

export class InMemoryWorkflowVersionRepository implements WorkflowVersionRepository {
  readonly versions = new Map<string, WorkflowVersion>();

  constructor(private readonly workflows: InMemoryWorkflowRepository) {}

  async find(
    name: WorkflowName,
    semver: string,
  ): Promise<WorkflowVersion | null> {
    const workflow = await this.workflows.findByName(name);
    const found = [...this.versions.values()].find(
      (version) =>
        version.workflowId === workflow?.id && version.semver === semver,
    );
    return found ?? null;
  }

  async findById(id: string): Promise<WorkflowVersion | null> {
    return this.versions.get(id) ?? null;
  }

  async findToRun(
    name: WorkflowName,
    semver: string | null,
  ): Promise<WorkflowVersion | null> {
    if (semver !== null) return this.find(name, semver);

    const workflow = await this.workflows.findByName(name);
    const current = workflow?.currentVersionId ?? '';
    return this.versions.get(current) ?? null;
  }

  async add(version: WorkflowVersion): Promise<void> {
    this.versions.set(version.id, version);
  }
}

// Runs the work at once: solitary tests have no database, so a transaction is the work itself.
export function directTransactions(): TransactionHost {
  const host = {
    withTransaction: (work: () => Promise<unknown>) => work(),
  };
  return host as unknown as TransactionHost;
}
