import type {
  Component,
  UnsupportedConstruct,
} from './automation/language/enums.js';
import type { JsonPointer } from './automation/language/json-pointer.js';

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

export abstract class DefinitionRejectedError extends RuleViolationError {
  readonly pointer: string;

  constructor(pointer: string, message: string) {
    super(message);
    this.pointer = pointer;
  }
}

export class InvalidDocumentError extends DefinitionRejectedError {}

export class UnsupportedConstructError extends DefinitionRejectedError {
  constructor(construct: UnsupportedConstruct, at: JsonPointer) {
    const pointer = at.toString();
    super(pointer, `${construct} is outside the supported subset`);
  }
}

export class UndeclaredComponentError extends DefinitionRejectedError {
  constructor(component: Component, name: string, at: JsonPointer) {
    const pointer = at.toString();
    super(pointer, `"${name}" is not declared in use.${component}`);
  }
}

export class InvalidExpressionError extends DefinitionRejectedError {
  constructor(at: JsonPointer, failure: string) {
    const pointer = at.toString();
    super(pointer, `Invalid expression: ${failure}`);
  }
}

export class DuplicateTaskError extends DefinitionRejectedError {
  constructor(name: string, at: JsonPointer) {
    const pointer = at.toString();
    super(pointer, `Another task in this list is named "${name}"`);
  }
}

export class UnknownTaskError extends DefinitionRejectedError {
  constructor(name: string, at: JsonPointer) {
    const pointer = at.toString();
    super(pointer, `"${name}" is not a task of this list`);
  }
}

export class EmptyCompetingForkError extends DefinitionRejectedError {
  constructor(at: JsonPointer) {
    const pointer = at.toString();
    super(pointer, 'A competing fork needs at least one branch');
  }
}

export abstract class InvalidValueError extends RuleViolationError {}

export class NegativeDurationError extends InvalidValueError {
  constructor() {
    super('A duration cannot be negative');
  }
}

export class UncomputableDurationError extends InvalidValueError {
  constructor() {
    super(
      'A fraction is allowed only in the smallest of the hours, minutes or seconds of a duration',
    );
  }
}

export class NegativeAttemptCountError extends InvalidValueError {
  constructor() {
    super('An attempt count cannot be negative');
  }
}

export class InvalidDocumentValueError extends DefinitionRejectedError {
  constructor(at: JsonPointer, cause: InvalidValueError) {
    const pointer = at.toString();
    super(pointer, cause.message);
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
