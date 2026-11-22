import { Missing } from "../../../../../src/application/identity/enums.js";
import { ResolveSessionUser } from "../../../../../src/application/identity/users/resolve-session-user.js";
import {
  UserRefusal,
  UserStatus,
} from "../../../../../src/domain/identity/users/enums.js";
import { aUser } from "../../../../support/builders.js";
import { InMemoryUserRepository } from "../../../../support/fakes.js";

describe("ResolveSessionUser", () => {
  it("a_session_of_an_active_user_yields_the_user", async () => {
    const user = aUser();
    const users = new InMemoryUserRepository(user);
    const resolve = new ResolveSessionUser(users);

    const resolved = await resolve.execute(user.id);

    expect(resolved).toEqual({ ok: true, value: user });
  });

  it("a_session_of_a_suspended_user_is_refused_as_suspended", async () => {
    const suspended = aUser({ status: UserStatus.Suspended });
    const users = new InMemoryUserRepository(suspended);
    const resolve = new ResolveSessionUser(users);

    const resolved = await resolve.execute(suspended.id);

    expect(resolved).toEqual({ ok: false, failure: UserRefusal.Suspended });
  });

  it("a_session_of_an_unknown_user_is_refused_as_missing", async () => {
    const user = aUser();
    const users = new InMemoryUserRepository(user);
    const resolve = new ResolveSessionUser(users);

    const resolved = await resolve.execute("someone-else");

    expect(resolved).toEqual({ ok: false, failure: Missing.User });
  });
});
