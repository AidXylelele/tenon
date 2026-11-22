import {
  Role,
  UserRefusal,
  UserStatus,
} from "../../../src/domain/identity/enums.js";
import { User } from "../../../src/domain/identity/user.js";
import { aUser } from "../../support/builders.js";

const now = new Date("2026-10-11T10:00:00.000Z");

describe("User", () => {
  it.each([
    { role: Role.Admin, admin: true },
    { role: Role.Editor, admin: false },
    { role: Role.Viewer, admin: false },
  ])(
    "only_the_administrator_role_is_an_administrator ($role)",
    ({ role, admin }) => {
      const user = aUser({ role });

      expect(user.isAdmin).toBe(admin);
    },
  );

  it.each([
    { role: Role.Admin, editor: false },
    { role: Role.Editor, editor: true },
    { role: Role.Viewer, editor: false },
  ])("only_the_editor_role_is_an_editor ($role)", ({ role, editor }) => {
    const user = aUser({ role });

    expect(user.isEditor).toBe(editor);
  });

  it("a_created_user_is_active_and_gets_a_fresh_identity", () => {
    const user = User.create({
      email: "new@example.com",
      name: "New",
      role: Role.Editor,
      now,
    });

    const created = {
      id: user.id,
      createdAt: user.createdAt,
      status: user.status,
      role: user.role,
    };
    const uuid: unknown = expect.stringMatching(/^[0-9a-f-]{36}$/);
    expect(created).toEqual({
      id: uuid,
      createdAt: now,
      status: UserStatus.Active,
      role: Role.Editor,
    });
    expect(user.canSignIn()).toEqual({ ok: true, value: undefined });
  });

  it("a_suspended_user_cannot_sign_in", () => {
    const user = aUser({ status: UserStatus.Suspended });

    expect(user.canSignIn()).toEqual({
      ok: false,
      failure: UserRefusal.Suspended,
    });
  });
});
