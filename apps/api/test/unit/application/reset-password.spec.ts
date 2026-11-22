import { ResetPassword } from "../../../src/application/identity/accounts/reset-password.js";
import { Missing } from "../../../src/application/identity/enums.js";
import { aPasswordAccount, aUser } from "../../support/builders.js";
import {
  InMemoryAccountRepository,
  InMemoryUserRepository,
} from "../../support/fakes.js";

describe("ResetPassword", () => {
  it("the_new_hash_replaces_the_password_of_the_existing_account", async () => {
    const user = aUser();
    const account = aPasswordAccount(user, "old-hash");
    const accounts = new InMemoryAccountRepository(account);
    const users = new InMemoryUserRepository();
    const reset = new ResetPassword(accounts, users);

    await reset.execute({ userId: "user-1", passwordHash: "new-hash" });

    expect(account.passwordHash).toBe("new-hash");
    expect(accounts.accounts.size).toBe(1);
  });

  it("a_user_without_a_password_gets_a_password_account", async () => {
    const accounts = new InMemoryAccountRepository();
    const admin = aUser({ email: "admin@example.com" });
    const users = new InMemoryUserRepository(admin);
    const reset = new ResetPassword(accounts, users);

    await reset.execute({ userId: "user-1", passwordHash: "first-hash" });

    const account = await accounts.findByUserId("user-1");
    const created = {
      identifier: account?.identifier,
      passwordHash: account?.passwordHash,
    };
    expect(created).toEqual({
      identifier: "admin@example.com",
      passwordHash: "first-hash",
    });
  });

  it("an_unknown_user_is_reported_as_not_found", async () => {
    const accounts = new InMemoryAccountRepository();
    const users = new InMemoryUserRepository();
    const reset = new ResetPassword(accounts, users);

    const refused = await reset.execute({
      userId: "nobody",
      passwordHash: "hash",
    });

    expect(refused).toEqual({ ok: false, failure: Missing.User });
  });
});
