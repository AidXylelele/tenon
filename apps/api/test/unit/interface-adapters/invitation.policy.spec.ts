import { InvitationPolicy } from "../../../src/interface-adapters/api/auth/invitation.policy.js";
import { Role } from "../../../src/domain/identity/enums.js";
import { aUser } from "../../support/builders.js";

describe("InvitationPolicy", () => {
  const policy = new InvitationPolicy();
  const editor = aUser({ role: Role.Editor });
  const viewer = aUser({ role: Role.Viewer });

  it("an_administrator_manages_invitations", () => {
    const admin = aUser({ role: Role.Admin });

    const manages = policy.manage(admin);

    expect(manages).toBe(true);
  });

  it.each([
    { who: "an editor", user: editor },
    { who: "a viewer", user: viewer },
    { who: "a guest", user: null },
  ])("nobody_but_an_administrator_manages_invitations ($who)", ({ user }) => {
    const manages = policy.manage(user);

    expect(manages).toBe(false);
  });
});
