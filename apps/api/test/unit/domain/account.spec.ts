import { Account } from "../../../src/domain/identity/accounts/account.js";
import { aPasswordAccount, aUser } from "../../support/builders.js";

const now = new Date("2026-10-11T10:00:00.000Z");

describe("Account", () => {
  it("a_password_account_belongs_to_the_user_and_is_identified_by_their_email", () => {
    const user = aUser({ email: "user@example.com" });

    const account = Account.password(user, "first", now);

    const created = {
      id: account.id,
      userId: account.userId,
      identifier: account.identifier,
      passwordHash: account.passwordHash,
      version: account.version,
    };
    const uuid: unknown = expect.stringMatching(/^[0-9a-f-]{36}$/);
    expect(created).toEqual({
      id: uuid,
      userId: user.id,
      identifier: "user@example.com",
      passwordHash: "first",
      version: 0,
    });
  });

  it("changing_the_password_replaces_the_stored_hash", () => {
    const user = aUser();
    const account = aPasswordAccount(user, "first");

    account.changePassword("second", now);

    expect(account.passwordHash).toBe("second");
  });
});
