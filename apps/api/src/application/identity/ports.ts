import type { Account } from "../../domain/identity/account.js";
import type { Invitation } from "../../domain/identity/invitation.js";
import type { InvitationToken } from "../../domain/identity/invitation-token.js";
import type { User } from "../../domain/identity/user.js";

export abstract class UserRepository {
  abstract add(user: User): Promise<void>;
  abstract find(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
}

export abstract class AccountRepository {
  abstract save(account: Account): Promise<void>;
  abstract findByEmail(email: string): Promise<Account | null>;
  abstract findByUserId(userId: string): Promise<Account | null>;
}

export abstract class InvitationRepository {
  abstract save(invitation: Invitation): Promise<void>;
  abstract find(id: string): Promise<Invitation | null>;
  abstract findByToken(token: InvitationToken): Promise<Invitation | null>;
  abstract findPendingByEmail(email: string): Promise<Invitation | null>;
}

export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  abstract verify(password: string, hash: string | null): Promise<boolean>;
}

export abstract class Sessions {
  abstract endAll(userId: string, except: string | null): Promise<void>;
}

export abstract class Mailing {
  abstract sendInvitation(
    invitation: Invitation,
    token: InvitationToken,
    inviterName: string,
  ): Promise<void>;
  abstract sendPasswordReset(
    to: string,
    link: string,
    expiresAt: Date,
  ): Promise<void>;
}
