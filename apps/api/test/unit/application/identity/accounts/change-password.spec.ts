import { ChangePassword } from "../../../../../src/application/identity/accounts/change-password.js";
import { AccountRefusal } from "../../../../../src/domain/identity/accounts/enums.js";
import {
  aPasswordAccount,
  PASSWORD,
  passwords,
} from "../../../../support/builders.js";
import {
  InMemoryAccountRepository,
  RecordingSessions,
  FakeUnitOfWork,
} from "../../../../support/fakes.js";

const unitOfWork = new FakeUnitOfWork();

const changingWith = (
  accounts: InMemoryAccountRepository,
  sessions: RecordingSessions,
) => new ChangePassword(accounts, passwords, sessions, unitOfWork);

describe("ChangePassword", () => {
  it("the_correct_current_password_lets_the_new_one_replace_it", async () => {
    const account = aPasswordAccount();
    const accounts = new InMemoryAccountRepository(account);
    const sessions = new RecordingSessions();
    const change = changingWith(accounts, sessions);

    await change.execute({
      userId: "user-1",
      sessionId: "session-1",
      currentPassword: PASSWORD,
      newPassword: "another-long-password",
    });

    const newPasswordVerified = await passwords.verify(
      "another-long-password",
      account.passwordHash,
    );
    expect(newPasswordVerified).toBe(true);
    const oldPasswordVerified = await passwords.verify(
      PASSWORD,
      account.passwordHash,
    );
    expect(oldPasswordVerified).toBe(false);
  });

  it("a_new_password_ends_every_other_session_of_the_user", async () => {
    const account = aPasswordAccount();
    const accounts = new InMemoryAccountRepository(account);
    const sessions = new RecordingSessions();
    const change = changingWith(accounts, sessions);

    await change.execute({
      userId: "user-1",
      sessionId: "session-1",
      currentPassword: PASSWORD,
      newPassword: "another-long-password",
    });

    expect(sessions.ended).toEqual([{ userId: "user-1", except: "session-1" }]);
  });

  it("a_wrong_current_password_is_refused_and_the_password_and_sessions_stay", async () => {
    const account = aPasswordAccount();
    const accounts = new InMemoryAccountRepository(account);
    const sessions = new RecordingSessions();
    const change = changingWith(accounts, sessions);

    const refused = await change.execute({
      userId: "user-1",
      sessionId: "session-1",
      currentPassword: "not-the-password",
      newPassword: "another-long-password",
    });

    expect(refused).toEqual({
      ok: false,
      failure: AccountRefusal.WrongPassword,
    });
    const passwordVerified = await passwords.verify(
      PASSWORD,
      account.passwordHash,
    );
    expect(passwordVerified).toBe(true);
    expect(sessions.ended).toEqual([]);
  });

  it("a_user_without_a_password_account_is_refused_as_a_wrong_password", async () => {
    const accounts = new InMemoryAccountRepository();
    const sessions = new RecordingSessions();
    const change = changingWith(accounts, sessions);

    const refused = await change.execute({
      userId: "user-1",
      sessionId: "session-1",
      currentPassword: PASSWORD,
      newPassword: "another-long-password",
    });

    expect(refused).toEqual({
      ok: false,
      failure: AccountRefusal.WrongPassword,
    });
  });
});
