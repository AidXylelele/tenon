import { AcceptInvitation } from "../../../src/application/identity/invitations/accept-invitation.js";
import { Missing } from "../../../src/application/identity/enums.js";
import { VerifyInvitationLink } from "../../../src/application/identity/invitations/verify-invitation-link.js";
import {
  InvitationRefusal,
  InvitationStatus,
} from "../../../src/domain/identity/invitations/enums.js";
import { Role } from "../../../src/domain/identity/users/enums.js";
import { InvitationToken } from "../../../src/domain/identity/invitations/invitation-token.js";
import {
  anInvitation,
  anInvitee,
  aUser,
  PASSWORD,
  passwords,
} from "../../support/builders.js";
import {
  InMemoryAccountRepository,
  InMemoryInvitationRepository,
  InMemoryUserRepository,
} from "../../support/fakes.js";

const now = new Date();
const eightDays = 8 * 24 * 60 * 60 * 1000;
const eightDaysAgo = now.getTime() - eightDays;
const createdEightDaysAgo = new Date(eightDaysAgo);

const aUsedInvitation = () => {
  const invited = anInvitation();
  invited.invitation.accept(anInvitee("someone"), null, now);
  return invited;
};

const aRevokedInvitation = () => {
  const invited = anInvitation();
  invited.invitation.revoke(now);
  return invited;
};

const anExpiredInvitation = () => anInvitation({}, createdEightDaysAgo);

const acceptingWith = (
  invitations: InMemoryInvitationRepository,
  users: InMemoryUserRepository,
  accounts: InMemoryAccountRepository,
) => new AcceptInvitation(invitations, users, accounts, passwords);

describe("VerifyInvitationLink", () => {
  it("the_link_of_a_pending_invitation_shows_whom_it_invites", async () => {
    const { invitation, token } = anInvitation({ role: Role.Editor });
    const invitations = new InMemoryInvitationRepository(invitation);
    const verify = new VerifyInvitationLink(invitations);

    const verified = await verify.execute(token.value);

    expect(verified).toMatchObject({
      ok: true,
      value: { email: "invitee@example.com", role: Role.Editor },
    });
  });

  it.each([
    {
      state: "used",
      invited: aUsedInvitation,
      refusal: InvitationRefusal.Accepted,
    },
    {
      state: "revoked",
      invited: aRevokedInvitation,
      refusal: InvitationRefusal.Revoked,
    },
    {
      state: "expired",
      invited: anExpiredInvitation,
      refusal: InvitationRefusal.Expired,
    },
  ])(
    "an_invitation_that_cannot_be_used_is_refused_with_its_reason ($state)",
    async ({ invited, refusal }) => {
      const { invitation, token } = invited();
      const invitations = new InMemoryInvitationRepository(invitation);
      const verify = new VerifyInvitationLink(invitations);

      const refused = await verify.execute(token.value);

      expect(refused).toEqual({ ok: false, failure: refusal });
    },
  );

  it("an_unknown_token_is_not_found", async () => {
    const { invitation } = anInvitation();
    const invitations = new InMemoryInvitationRepository(invitation);
    const verify = new VerifyInvitationLink(invitations);
    const unknown = InvitationToken.generate();

    const refused = await verify.execute(unknown.value);

    expect(refused).toEqual({ ok: false, failure: Missing.Invitation });
  });
});

describe("AcceptInvitation", () => {
  it("accepting_creates_the_user_with_the_invited_email_and_role_and_the_given_name", async () => {
    const { invitation, token } = anInvitation({ role: Role.Editor });
    const invitations = new InMemoryInvitationRepository(invitation);
    const users = new InMemoryUserRepository();
    const accounts = new InMemoryAccountRepository();
    const accept = acceptingWith(invitations, users, accounts);

    const accepted = await accept.execute({
      token: token.value,
      name: "Newcomer",
      password: PASSWORD,
    });

    const stored = await users.findByEmail("invitee@example.com");
    expect(accepted).toEqual({
      ok: true,
      value: {
        id: stored?.id,
        email: "invitee@example.com",
        name: "Newcomer",
        role: Role.Editor,
        isAdmin: false,
        mayChangeAutomation: true,
      },
    });
  });

  it("accepting_gives_the_user_a_password_account_with_the_given_password", async () => {
    const { invitation, token } = anInvitation();
    const invitations = new InMemoryInvitationRepository(invitation);
    const users = new InMemoryUserRepository();
    const accounts = new InMemoryAccountRepository();
    const accept = acceptingWith(invitations, users, accounts);

    await accept.execute({
      token: token.value,
      name: "Newcomer",
      password: PASSWORD,
    });

    const user = await users.findByEmail("invitee@example.com");
    const account = await accounts.findByEmail("invitee@example.com");
    expect(account?.userId).toBe(user?.id);
    const passwordHash = account?.passwordHash ?? null;
    const verified = await passwords.verify(PASSWORD, passwordHash);
    expect(verified).toBe(true);
  });

  it("accepting_marks_the_invitation_accepted_by_the_new_user", async () => {
    const { invitation, token } = anInvitation();
    const invitations = new InMemoryInvitationRepository(invitation);
    const users = new InMemoryUserRepository();
    const accounts = new InMemoryAccountRepository();
    const accept = acceptingWith(invitations, users, accounts);

    await accept.execute({
      token: token.value,
      name: "Newcomer",
      password: PASSWORD,
    });

    const user = await users.findByEmail("invitee@example.com");
    const settled = {
      status: invitation.status,
      acceptedUserId: invitation.acceptedUserId,
    };
    expect(settled).toEqual({
      status: InvitationStatus.Accepted,
      acceptedUserId: user?.id,
    });
  });

  it("an_invitation_whose_email_got_an_account_meanwhile_is_refused_leaving_it_pending_and_adding_no_user", async () => {
    const { invitation, token } = anInvitation();
    const invitations = new InMemoryInvitationRepository(invitation);
    const existing = aUser({ email: "invitee@example.com" });
    const users = new InMemoryUserRepository(existing);
    const accounts = new InMemoryAccountRepository();
    const accept = acceptingWith(invitations, users, accounts);

    const refused = await accept.execute({
      token: token.value,
      name: "Late",
      password: PASSWORD,
    });

    expect(refused).toEqual({
      ok: false,
      failure: InvitationRefusal.EmailTaken,
    });
    expect(invitation.status).toBe(InvitationStatus.Pending);
    expect(users.users.size).toBe(1);
  });

  it("an_invitation_accepted_before_is_refused_as_accepted", async () => {
    const { invitation, token } = aUsedInvitation();
    const invitations = new InMemoryInvitationRepository(invitation);
    const users = new InMemoryUserRepository();
    const accounts = new InMemoryAccountRepository();
    const accept = acceptingWith(invitations, users, accounts);

    const refused = await accept.execute({
      token: token.value,
      name: "Again",
      password: PASSWORD,
    });

    expect(refused).toEqual({
      ok: false,
      failure: InvitationRefusal.Accepted,
    });
    expect(users.users.size).toBe(0);
  });
});
