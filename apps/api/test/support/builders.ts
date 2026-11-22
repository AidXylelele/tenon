import {
  TurnStatus,
  WaitKind,
} from "../../src/domain/automation/instances/enums.js";
import type {
  AwaitedEffect,
  Listening,
  RunEnding,
  RunTurn,
} from "../../src/domain/automation/instances/interfaces.js";
import type { JsonObject } from "../../src/domain/automation/interfaces.js";
import { CheckedDefinition } from "../../src/domain/automation/workflows/checked-definition.js";
import { WorkflowName } from "../../src/domain/automation/workflows/workflow-name.js";
import { Account } from "../../src/domain/identity/account.js";
import { Role, UserStatus } from "../../src/domain/identity/enums.js";
import type { UserProps } from "../../src/domain/identity/interfaces.js";
import { Invitation } from "../../src/domain/identity/invitation.js";
import { InvitationToken } from "../../src/domain/identity/invitation-token.js";
import { User } from "../../src/domain/identity/user.js";
import { FakePasswordHasher } from "./fakes.js";

export const PASSWORD = "correct-horse-battery-staple";

export const aUser = (overrides: Partial<UserProps> = {}): User =>
  new User({
    id: "user-1",
    email: "user@example.com",
    name: "User",
    role: Role.Viewer,
    status: UserStatus.Active,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
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
  const created = Invitation.create({
    email: "invitee@example.com",
    role: Role.Editor,
    invitedBy: "admin-1",
    token,
    holder: null,
    now,
    ...overrides,
  });

  if (!created.ok) throw new Error(created.failure);

  return { invitation: created.value, token };
};

export const anInvitee = (id = "invitee-1"): User =>
  aUser({ id, email: "invitee@example.com" });

export const passwords = new FakePasswordHasher();

export interface DocumentHeader {
  readonly namespace?: string;
  readonly name?: string;
  readonly version?: string;
  readonly dsl?: string;
}

export const aDocument = (
  header: DocumentHeader = {},
  tasks: JsonObject[] = [{ greet: { set: { greeting: "hello" } } }],
): JsonObject => ({
  document: {
    dsl: header.dsl ?? "1.1.0",
    namespace: header.namespace ?? "sales",
    name: header.name ?? "route-lead",
    version: header.version ?? "1.0.0",
  },
  do: tasks,
});

export const aDefinition = (
  header: DocumentHeader = {},
  digest = "digest-1",
): CheckedDefinition => {
  const document = aDocument(header);
  const declared = document.document as Required<DocumentHeader>;
  const name = new WorkflowName(declared.namespace, declared.name);
  return new CheckedDefinition({
    name,
    version: declared.version,
    dsl: declared.dsl,
    digest,
    document,
    imports: {},
    programFingerprint: digest,
    schedule: null,
    secrets: [],
  });
};

export const aTurn = (overrides: Partial<RunTurn> = {}): RunTurn => ({
  status: TurnStatus.Running,
  fingerprint: "program-1",
  format: 1,
  memento: { state: 1 },
  requested: [],
  listening: [],
  receiving: [],
  endedExecutions: [],
  taskValues: [],
  answered: [],
  withdrawn: [],
  abandoned: [],
  taken: null,
  events: [],
  output: null,
  error: null,
  ...overrides,
});

export const aFaultedEnding = (): RunEnding => {
  const error = {
    type: "https://open-workflow-specification.org/spec/1.0.0/errors/runtime",
    status: 500,
    title: "Runtime Error",
    detail: "The platform could not run the instance",
    instance: "",
  };
  const event = {
    name: "workflow.faulted",
    types: ["org.open-workflow-specification.workflow.faulted.v1"],
    data: { name: "route-lead-instance-1.sales", error },
    execution: null,
  };
  return { events: [event], error };
};

export const aCancelledEnding = (): RunEnding => {
  const event = {
    name: "workflow.cancelled",
    types: ["org.open-workflow-specification.workflow.cancelled.v1"],
    data: { name: "route-lead-instance-1.sales" },
    execution: null,
  };
  return { events: [event], error: null };
};

export const aTimer = (id: string): AwaitedEffect => ({
  id,
  request: { id, kind: "timer", until: 0, deadline: null },
  wait: {
    effectId: id,
    kind: WaitKind.Timer,
    until: 0,
    stream: null,
    retryOf: null,
    execution: null,
    position: null,
  },
});

export const aCall = (id: string): AwaitedEffect => ({
  id,
  request: { id, kind: "http", deadline: null },
  wait: null,
});

export const aListen = (id: string, execution: string): Listening => ({
  effectId: id,
  execution,
  stream: "/do/0/heard/listen/to|stream",
  position: 0,
  open: [{ level: 0, filter: 0 }],
});
