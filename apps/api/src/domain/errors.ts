import type { GraphFault, Problem } from './interfaces.js';

export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('Invalid email or password');
  }
}

export class UserSuspendedError extends DomainError {
  constructor() {
    super('The account is suspended');
  }
}

export class UserNotFoundError extends DomainError {
  constructor() {
    super('The user does not exist');
  }
}

export class AccountExistsError extends DomainError {
  constructor() {
    super('An account with this email address already exists');
  }
}

export class AccountWithoutPasswordError extends DomainError {
  constructor() {
    super('The account does not sign in with a password');
  }
}

export class AccountConflictError extends DomainError {
  constructor() {
    super('The account was changed concurrently');
  }
}

export class InvalidPasswordError extends DomainError {
  constructor() {
    super('The current password is wrong');
  }
}

export class InvitationNotFoundError extends DomainError {
  constructor() {
    super('The invitation does not exist');
  }
}

export class InvitationUsedError extends DomainError {
  constructor() {
    super('The invitation has already been accepted');
  }
}

export class InvitationRevokedError extends DomainError {
  constructor() {
    super('The invitation has been revoked');
  }
}

export class InvitationExpiredError extends DomainError {
  constructor() {
    super('The invitation has expired');
  }
}

export class InvitationConflictError extends DomainError {
  constructor() {
    super('The invitation was changed concurrently');
  }
}

export class WorkflowNotFoundError extends DomainError {
  constructor() {
    super('The workflow does not exist');
  }
}

export class ReleaseNotFoundError extends DomainError {
  constructor() {
    super('The release does not exist');
  }
}

export class RunNotFoundError extends DomainError {
  constructor() {
    super('The run does not exist');
  }
}

export class NodeNotFoundError extends DomainError {
  constructor() {
    super('The node is not in the graph');
  }
}

export class WebhookEndpointNotFoundError extends DomainError {
  constructor() {
    super('The webhook endpoint does not exist');
  }
}

export class WorkflowAccessDeniedError extends DomainError {
  constructor() {
    super('Only the owner or an administrator may change this workflow');
  }
}

export class WorkflowConflictError extends DomainError {
  constructor() {
    super('The workflow was changed concurrently');
  }
}

export class ReleaseConflictError extends DomainError {
  constructor() {
    super('The release already exists');
  }
}

export class RunConflictError extends DomainError {
  constructor() {
    super('The run was changed concurrently');
  }
}

export class WebhookEndpointConflictError extends DomainError {
  constructor() {
    super('The webhook endpoint was changed concurrently');
  }
}

export class WorkflowArchivedError extends DomainError {
  constructor() {
    super('The workflow is archived');
  }
}

export class WorkflowNotArchivedError extends DomainError {
  constructor() {
    super('The workflow is not archived');
  }
}

export class WorkflowInactiveError extends DomainError {
  constructor() {
    super('The workflow does not serve this release');
  }
}

export class RunFinishedError extends DomainError {
  constructor() {
    super('The run has already finished');
  }
}

export class NotATriggerError extends DomainError {
  constructor() {
    super('The node is not a trigger');
  }
}

export class ReleaseWithoutTriggerError extends DomainError {
  constructor() {
    super('The release has no trigger node');
  }
}

export class InvalidOwnerError extends DomainError {
  constructor() {
    super('Only an editor or an administrator can own a workflow');
  }
}

export class InvalidGraphError extends DomainError {
  readonly faults: readonly GraphFault[];

  constructor(faults: readonly GraphFault[]) {
    super('The graph is malformed');
    this.faults = faults;
  }
}

export class NodeConfigurationError extends DomainError {
  readonly problems: readonly Problem[];

  constructor(problems: readonly Problem[]) {
    super('Nodes of the graph have configuration problems');
    this.problems = problems;
  }
}

export class StorageUnavailableError extends DomainError {
  constructor() {
    super('The run data is temporarily unavailable');
  }
}
