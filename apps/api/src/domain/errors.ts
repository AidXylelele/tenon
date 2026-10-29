import type { Problem } from './automation/language/problem.js';

export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export abstract class NotFoundError extends DomainError {}

export abstract class ConflictError extends DomainError {}

export abstract class RuleViolationError extends DomainError {}

export abstract class ExpiredError extends DomainError {}

export abstract class AuthenticationError extends DomainError {}

export abstract class ForbiddenError extends DomainError {}

export class InvalidCredentialsError extends AuthenticationError {
  constructor() {
    super('Invalid email or password');
  }
}

export class UserSuspendedError extends ForbiddenError {
  constructor() {
    super('The account is suspended');
  }
}

export class UserNotFoundError extends NotFoundError {
  constructor() {
    super('The user does not exist');
  }
}

export class AccountExistsError extends ConflictError {
  constructor() {
    super('An account with this email address already exists');
  }
}

export class AccountWithoutPasswordError extends RuleViolationError {
  constructor() {
    super('The account does not sign in with a password');
  }
}

export class AccountConflictError extends ConflictError {
  constructor() {
    super('The account was changed concurrently');
  }
}

export class InvalidPasswordError extends RuleViolationError {
  constructor() {
    super('The current password is wrong');
  }
}

export class InvitationNotFoundError extends NotFoundError {
  constructor() {
    super('The invitation does not exist');
  }
}

export class InvitationUsedError extends ExpiredError {
  constructor() {
    super('The invitation has already been accepted');
  }
}

export class InvitationRevokedError extends ExpiredError {
  constructor() {
    super('The invitation has been revoked');
  }
}

export class InvitationExpiredError extends ExpiredError {
  constructor() {
    super('The invitation has expired');
  }
}

export class InvitationConflictError extends ConflictError {
  constructor() {
    super('The invitation was changed concurrently');
  }
}

export class StaleWriteError extends ConflictError {
  constructor() {
    super('The resource was changed meanwhile; read it again and retry');
  }
}

export class DefinitionRejectedError extends RuleViolationError {
  readonly problems: readonly Problem[];

  constructor(problems: readonly Problem[]) {
    super('The document has problems');
    this.problems = problems;
  }
}

export class VersionConflictError extends ConflictError {
  constructor() {
    super(
      'A different document is already published under this namespace, name and version',
    );
  }
}

export class WorkflowNotFoundError extends NotFoundError {
  constructor() {
    super('The workflow does not exist');
  }
}

export class VersionNotFoundError extends NotFoundError {
  constructor() {
    super('The workflow version does not exist');
  }
}
