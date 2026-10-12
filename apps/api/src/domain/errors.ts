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
