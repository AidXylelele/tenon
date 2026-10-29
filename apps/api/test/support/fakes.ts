import type { ExpressionEvaluator } from '../../src/application/automation/language/ports.js';
import type {
  DocumentReader,
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../../src/application/automation/workflows/ports.js';
import type {
  VersionDocument,
  VersionSummary,
  WorkflowPage,
  WorkflowQueries,
  WorkflowSummary,
} from '../../src/application/automation/workflows/queries.js';
import { DocumentReading } from '../../src/domain/automation/language/document-reading.js';
import type { Expression } from '../../src/domain/automation/language/expression.js';
import type {
  ParsedDocument,
  PublishedTargets,
} from '../../src/domain/automation/language/interfaces.js';
import { Problem } from '../../src/domain/automation/language/problem.js';
import type { WorkflowName } from '../../src/domain/automation/language/workflow-name.js';
import type { SourceDocument } from '../../src/domain/automation/workflows/source-document.js';
import type { Workflow } from '../../src/domain/automation/workflows/workflow.js';
import type { WorkflowVersion } from '../../src/domain/automation/workflows/workflow-version.js';
import type {
  AccountRepository,
  InvitationEmail,
  InvitationRepository,
  Mailing,
  PasswordHasher,
  PasswordResetEmail,
  UserRepository,
} from '../../src/application/identity/ports.js';
import type { Account } from '../../src/domain/identity/account.js';
import {
  type AccountType,
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

  async findByEmail(email: string): Promise<User | null> {
    return this.all().find((user) => sameEmail(user, email)) ?? null;
  }

  async findActiveById(id: string): Promise<User | null> {
    return this.all().find((user) => user.id === id && user.isActive) ?? null;
  }

  async findActiveByEmail(email: string): Promise<User | null> {
    const user = await this.findByEmail(email);

    if (!user?.isActive) return null;

    return user;
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

  async findByIdentifier(
    type: AccountType,
    identifier: string,
  ): Promise<Account | null> {
    return (
      this.all().find(
        (account) => account.type === type && account.identifier === identifier,
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

export class RecordingMailing implements Mailing {
  readonly sent: InvitationEmail[] = [];
  readonly resets: PasswordResetEmail[] = [];

  async sendInvitation(email: InvitationEmail): Promise<void> {
    this.sent.push(email);
  }

  async sendPasswordReset(email: PasswordResetEmail): Promise<void> {
    this.resets.push(email);
  }
}

const sameEmail = (user: User, email: string): boolean =>
  user.email.toLowerCase() === email.toLowerCase();

export class JsonDocumentReader implements DocumentReader {
  read(source: SourceDocument): DocumentReading {
    try {
      const parsed = JSON.parse(source.text) as ParsedDocument;
      return new DocumentReading(parsed, []);
    } catch {
      const problem = new Problem('', 'The document is not JSON');
      return new DocumentReading(null, [problem]);
    }
  }
}

export class FakeExpressionEvaluator implements ExpressionEvaluator {
  constructor(private readonly refused: ReadonlySet<string> = new Set()) {}

  async check(expressions: readonly Expression[]): Promise<readonly Problem[]> {
    return expressions
      .filter((expression) => this.refused.has(expression.program))
      .map((expression) => new Problem(expression.pointer, 'syntax error'));
  }
}

export class InMemoryWorkflowRepository implements WorkflowRepository {
  readonly workflows = new Map<string, Workflow>();

  async findByName(name: WorkflowName): Promise<Workflow | null> {
    const found = [...this.workflows.values()].find((workflow) =>
      workflow.workflowName.equals(name),
    );
    return found ?? null;
  }

  async save(workflow: Workflow): Promise<void> {
    this.workflows.set(workflow.id, workflow);
  }
}

export class InMemoryWorkflowVersionRepository implements WorkflowVersionRepository {
  readonly versions: WorkflowVersion[] = [];

  async find(
    name: WorkflowName,
    semver: string,
  ): Promise<WorkflowVersion | null> {
    const found = this.versions.find(
      (version) =>
        version.definition.workflow.equals(name) && version.semver === semver,
    );
    return found ?? null;
  }

  async add(version: WorkflowVersion): Promise<void> {
    this.versions.push(version);
  }
}

export class InMemoryWorkflowQueries implements WorkflowQueries {
  constructor(
    private readonly versionRepository: InMemoryWorkflowVersionRepository,
  ) {}

  async list(): Promise<WorkflowPage> {
    return { items: [], next: null };
  }

  async get(): Promise<WorkflowSummary | null> {
    return null;
  }

  async versions(): Promise<readonly VersionSummary[]> {
    return [];
  }

  async document(): Promise<VersionDocument | null> {
    return null;
  }

  async referenceFacts(): Promise<PublishedTargets> {
    const published = this.versionRepository.versions.map(
      (version) => version.definition,
    );
    return {
      workflows: published.map((definition) => ({
        namespace: definition.workflow.namespace,
        name: definition.workflow.name,
      })),
      versions: published.map((definition) => ({
        namespace: definition.workflow.namespace,
        name: definition.workflow.name,
        version: definition.version,
      })),
    };
  }
}
