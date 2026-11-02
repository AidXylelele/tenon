import type {
  DefinitionReader,
  ExpressionEvaluator,
} from '../../src/application/automation/language/ports.js';
import type {
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../../src/application/automation/workflows/ports.js';
import type { Definition } from '../../src/domain/automation/language/definition.js';
import type { Expression } from '../../src/domain/automation/language/expression.js';
import type { WorkflowName } from '../../src/domain/automation/language/workflow-name.js';
import type { VersionReference } from '../../src/domain/automation/workflows/version-reference.js';
import type { Workflow } from '../../src/domain/automation/workflows/workflow.js';
import type { WorkflowVersion } from '../../src/domain/automation/workflows/workflow-version.js';
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
  InvalidDocumentError,
  InvalidExpressionError,
  InvitationNotFoundError,
  UserNotFoundError,
} from '../../src/domain/errors.js';
import type { Invitation } from '../../src/domain/identity/invitation.js';
import type { InvitationToken } from '../../src/domain/identity/invitation-token.js';
import type { User } from '../../src/domain/identity/user.js';
import { DefinitionMapper } from '../../src/interface-adapters/workflows/definitions/mappers/definition.mapper.js';
import type {
  Evaluation,
  JsonObject,
} from '../../src/domain/automation/language/interfaces.js';
import { Evaluated } from '../../src/domain/automation/language/results/evaluated.js';
import type { EvaluationResult } from '../../src/domain/automation/language/results/evaluation-result.js';
import type * as Dsl from '../../src/interface-adapters/workflows/definitions/interfaces.js';
import { type SourceDocument } from '../../src/domain/automation/workflows/source-document.js';

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

export class JsonDefinitionReader implements DefinitionReader {
  async read(source: SourceDocument): Promise<Definition> {
    try {
      const document = JSON.parse(source.text) as JsonObject;
      const workflow = document as unknown as Dsl.Workflow;
      return DefinitionMapper.toDomain(workflow, document);
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new InvalidDocumentError('', 'The document is not JSON');

      throw error;
    }
  }
}

export class FakeExpressionEvaluator implements ExpressionEvaluator {
  constructor(private readonly refused: ReadonlySet<string> = new Set()) {}

  async check(expressions: readonly Expression[]): Promise<void> {
    const invalid = expressions.find((expression) =>
      this.refused.has(expression.program),
    );

    if (invalid !== undefined)
      throw new InvalidExpressionError(invalid.pointer, 'syntax error');
  }

  async evaluateAll(
    evaluations: readonly Evaluation[],
  ): Promise<readonly EvaluationResult[]> {
    return evaluations.map(
      (evaluation) => new Evaluated(evaluation.id, evaluation.data),
    );
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

  async save(workflow: Workflow): Promise<void> {
    this.workflows.set(workflow.id, workflow);
  }
}

export class InMemoryWorkflowVersionRepository implements WorkflowVersionRepository {
  readonly versions: WorkflowVersion[] = [];

  constructor(private readonly workflows: InMemoryWorkflowRepository) {}

  async find(
    name: WorkflowName,
    semver: string,
  ): Promise<WorkflowVersion | null> {
    const workflow = await this.workflows.findByName(name);
    const found = this.versions.find(
      (version) =>
        version.workflowId === workflow?.id && version.semver === semver,
    );
    return found ?? null;
  }

  async findBy(reference: VersionReference): Promise<WorkflowVersion | null> {
    const found = this.versions.find(
      (version) =>
        version.id === reference.versionId ||
        (version.workflowId === reference.workflowId &&
          version.semver === reference.semver),
    );
    return found ?? null;
  }

  async add(version: WorkflowVersion): Promise<void> {
    this.versions.push(version);
  }
}
