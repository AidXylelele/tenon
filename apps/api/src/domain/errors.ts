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

export class DuplicateDefaultCaseError extends DefinitionRejectedError {
  constructor(at: JsonPointer) {
    const pointer = at.toString();
    super(
      pointer,
      'A switch has only one default case; every other case needs a when',
    );
  }
}

export class InconsistentProgressError extends DomainError {
  constructor(reason: string) {
    super(`Inconsistent run-time state: ${reason}`);
  }
}

export class BranchJumpError extends DefinitionRejectedError {
  constructor(name: string, at: JsonPointer) {
    const pointer = at.toString();
    super(
      pointer,
      `A fork branch cannot go to "${name}": the branches run side by side`,
    );
  }
}

export class MalformedEventError extends DefinitionRejectedError {
  constructor(at: JsonPointer) {
    const pointer = at.toString();
    super(
      pointer,
      'An event to emit names its source and its type, and its attribute names are lower-case letters and digits',
    );
  }
}

export class ReservedVariableError extends DefinitionRejectedError {
  constructor(name: string, at: JsonPointer) {
    const pointer = at.toString();
    super(
      pointer,
      `"${name}" names a runtime argument of the standard, so it cannot name a variable`,
    );
  }
}

export class FunctionJumpError extends DefinitionRejectedError {
  constructor(name: string, at: JsonPointer) {
    const pointer = at.toString();
    super(
      pointer,
      `A function cannot go to "${name}": it runs apart from the tasks that call it`,
    );
  }
}

export abstract class InvalidValueError extends RuleViolationError {}

export class NegativeDurationError extends InvalidValueError {
  constructor() {
    super('A duration cannot be negative');
  }
}

export class CalendarDurationError extends InvalidValueError {
  constructor() {
    super(
      'A duration cannot count years, months or weeks, whose length depends on the calendar',
    );
  }
}

export class UncomputableDurationError extends InvalidValueError {
  constructor() {
    super(
      'The text is not an ISO 8601 duration with a fraction, if any, only in its smallest unit',
    );
  }
}

export class MalformedDurationError extends InvalidValueError {
  constructor() {
    super(
      'The value is not a duration: an ISO 8601 text or an object of days, hours, minutes, seconds and milliseconds',
    );
  }
}

export class NegativeAttemptCountError extends InvalidValueError {
  constructor() {
    super('An attempt count cannot be negative');
  }
}

export class UnknownValueError extends InvalidValueError {
  constructor(value: string) {
    super(`The standard defines no value '${value}' here`);
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

export class InstanceNotFoundError extends NotFoundError {
  constructor() {
    super('The workflow instance does not exist');
  }
}
