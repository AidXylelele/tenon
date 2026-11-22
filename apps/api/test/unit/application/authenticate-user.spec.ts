import { AuthenticateUser } from "../../../src/application/identity/authenticate-user.js";
import {
  AccountRefusal,
  UserRefusal,
  UserStatus,
} from "../../../src/domain/identity/enums.js";
import {
  aPasswordAccount,
  aUser,
  PASSWORD,
  passwords,
} from "../../support/builders.js";
import {
  InMemoryAccountRepository,
  InMemoryUserRepository,
} from "../../support/fakes.js";

const authenticateWith = (
  accounts: InMemoryAccountRepository,
  users: InMemoryUserRepository,
) => new AuthenticateUser(accounts, users, passwords);

const invalid = { ok: false, failure: AccountRefusal.InvalidCredentials };

describe("AuthenticateUser", () => {
  it("matching_credentials_yield_the_signed_in_user", async () => {
    const user = aUser();
    const account = aPasswordAccount(user);
    const accounts = new InMemoryAccountRepository(account);
    const users = new InMemoryUserRepository(user);
    const authenticate = authenticateWith(accounts, users);

    const authenticated = await authenticate.execute({
      email: "user@example.com",
      password: PASSWORD,
    });

    expect(authenticated).toEqual({
      ok: true,
      value: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: false,
        mayChangeAutomation: false,
      },
    });
  });

  it("a_wrong_password_is_refused_as_invalid_credentials", async () => {
    const user = aUser();
    const account = aPasswordAccount(user);
    const accounts = new InMemoryAccountRepository(account);
    const users = new InMemoryUserRepository(user);
    const authenticate = authenticateWith(accounts, users);

    const refused = await authenticate.execute({
      email: "user@example.com",
      password: "not-the-password",
    });

    expect(refused).toEqual(invalid);
  });

  it("an_unknown_email_is_refused_as_invalid_credentials", async () => {
    const user = aUser();
    const account = aPasswordAccount(user);
    const accounts = new InMemoryAccountRepository(account);
    const users = new InMemoryUserRepository(user);
    const authenticate = authenticateWith(accounts, users);

    const refused = await authenticate.execute({
      email: "nobody@example.com",
      password: PASSWORD,
    });

    expect(refused).toEqual(invalid);
  });

  it("a_user_without_a_password_account_is_refused_like_wrong_credentials", async () => {
    const user = aUser();
    const accounts = new InMemoryAccountRepository();
    const users = new InMemoryUserRepository(user);
    const authenticate = authenticateWith(accounts, users);

    const refused = await authenticate.execute({
      email: "user@example.com",
      password: PASSWORD,
    });

    expect(refused).toEqual(invalid);
  });

  it("a_suspended_user_with_correct_credentials_is_refused_as_suspended", async () => {
    const user = aUser({ status: UserStatus.Suspended });
    const account = aPasswordAccount(user);
    const accounts = new InMemoryAccountRepository(account);
    const users = new InMemoryUserRepository(user);
    const authenticate = authenticateWith(accounts, users);

    const refused = await authenticate.execute({
      email: "user@example.com",
      password: PASSWORD,
    });

    expect(refused).toEqual({ ok: false, failure: UserRefusal.Suspended });
  });
});
