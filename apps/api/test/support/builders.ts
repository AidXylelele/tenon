import type { JsonObject } from '../../src/domain/automation/json.js';
import { CheckedDefinition } from '../../src/domain/automation/workflows/checked-definition.js';
import { WorkflowName } from '../../src/domain/automation/workflows/workflow-name.js';
import { Account } from '../../src/domain/identity/account.js';
import { Role, UserStatus } from '../../src/domain/identity/enums.js';
import type { UserProps } from '../../src/domain/identity/interfaces.js';
import { Invitation } from '../../src/domain/identity/invitation.js';
import { InvitationToken } from '../../src/domain/identity/invitation-token.js';
import { User } from '../../src/domain/identity/user.js';
import { FakePasswordHasher } from './fakes.js';

export const PASSWORD = 'correct-horse-battery-staple';

export const aUser = (overrides: Partial<UserProps> = {}): User =>
  new User({
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    role: Role.Viewer,
    status: UserStatus.Active,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  });

export const aPasswordAccount = (
  user: User = aUser(),
  passwordHash = `hashed:${PASSWORD}`,
  now: Date = new Date(),
): Account => Account.password(user, passwordHash, now);

export const anInvitation = (
  overrides: Partial<{
    email: string;
    role: Role;
    invitedBy: string;
  }> = {},
  now: Date = new Date(),
): { invitation: Invitation; token: InvitationToken } => {
  const token = InvitationToken.generate();
  const invitation = Invitation.create({
    email: 'invitee@example.com',
    role: Role.Editor,
    invitedBy: 'admin-1',
    token,
    now,
    ...overrides,
  });
  return { invitation, token };
};

export const passwords = new FakePasswordHasher();

export interface DocumentHeader {
  readonly namespace?: string;
  readonly name?: string;
  readonly version?: string;
  readonly dsl?: string;
}

// A minimal DSL 1.0.3 document: one `set` task, with the header given.
export const aDocument = (
  header: DocumentHeader = {},
  tasks: JsonObject[] = [{ greet: { set: { greeting: 'hello' } } }],
): JsonObject => ({
  document: {
    dsl: header.dsl ?? '1.0.3',
    namespace: header.namespace ?? 'sales',
    name: header.name ?? 'route-lead',
    version: header.version ?? '1.0.0',
  },
  do: tasks,
});

export const aDefinition = (
  header: DocumentHeader = {},
  fingerprint = 'fingerprint-1',
): CheckedDefinition => {
  const document = aDocument(header);
  const declared = document.document as Record<string, string>;
  const name = new WorkflowName(declared.namespace!, declared.name!);
  return new CheckedDefinition({
    name,
    version: declared.version!,
    dsl: declared.dsl!,
    fingerprint,
    document,
  });
};
