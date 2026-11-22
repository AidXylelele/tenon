import { Missing } from "../../../src/application/identity/enums.js";
import { FindRecoveryAccount } from "../../../src/application/identity/accounts/find-recovery-account.js";
import {
  UserRefusal,
  UserStatus,
} from "../../../src/domain/identity/users/enums.js";
import { aPasswordAccount, aUser } from "../../support/builders.js";
import {
  InMemoryAccountRepository,
  InMemoryUserRepository,
} from "../../support/fakes.js";

describe("FindRecoveryAccount", () => {
  it("an_active_user_can_recover_the_password_of_their_account", async () => {
    const user = aUser();
    const account = aPasswordAccount(user);
    const users = new InMemoryUserRepository(user);
    const accounts = new InMemoryAccountRepository(account);
    const find = new FindRecoveryAccount(users, accounts);

    const found = await find.execute("user@example.com");

    expect(found).toEqual({
      ok: true,
      value: {
        userId: user.id,
        email: "user@example.com",
        passwordHash: account.passwordHash,
      },
    });
  });

  it("a_suspended_user_cannot_recover_a_password", async () => {
    const suspended = aUser({ status: UserStatus.Suspended });
    const account = aPasswordAccount(suspended);
    const users = new InMemoryUserRepository(suspended);
    const accounts = new InMemoryAccountRepository(account);
    const find = new FindRecoveryAccount(users, accounts);

    const found = await find.execute("user@example.com");

    expect(found).toEqual({ ok: false, failure: UserRefusal.Suspended });
  });

  it("an_unknown_email_cannot_recover_a_password", async () => {
    const user = aUser();
    const account = aPasswordAccount(user);
    const users = new InMemoryUserRepository(user);
    const accounts = new InMemoryAccountRepository(account);
    const find = new FindRecoveryAccount(users, accounts);

    const found = await find.execute("nobody@example.com");

    expect(found).toEqual({ ok: false, failure: Missing.User });
  });
});
