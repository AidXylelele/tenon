import type { Account } from "../../../domain/identity/accounts/account.js";

export abstract class AccountRepository {
  abstract save(account: Account): Promise<void>;
  abstract findByEmail(email: string): Promise<Account | null>;
  abstract findByUserId(userId: string): Promise<Account | null>;
}

export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  abstract verify(password: string, hash: string | null): Promise<boolean>;
}

export abstract class Sessions {
  abstract endAll(userId: string, except: string | null): Promise<void>;
}

export abstract class RecoveryMail {
  abstract sendPasswordReset(
    to: string,
    link: string,
    expiresAt: Date,
  ): Promise<void>;
}
