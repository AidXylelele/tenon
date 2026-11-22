import { InviteUser } from "../../../../../src/application/identity/invitations/invite-user.js";
import {
  InvitationRefusal,
  InvitationStatus,
} from "../../../../../src/domain/identity/invitations/enums.js";
import { Role } from "../../../../../src/domain/identity/users/enums.js";
import { anInvitation, aUser } from "../../../../support/builders.js";
import {
  InMemoryInvitationRepository,
  InMemoryUserRepository,
  RecordingInvitationMailer,
} from "../../../../support/fakes.js";

const command = {
  email: "invitee@example.com",
  role: Role.Editor,
  invitedBy: "admin-1",
  inviterName: "Ada Admin",
};

describe("InviteUser", () => {
  it("the_invitation_is_created_pending_for_the_email_and_the_role", async () => {
    const invitations = new InMemoryInvitationRepository();
    const mailer = new RecordingInvitationMailer();
    const users = new InMemoryUserRepository();
    const invite = new InviteUser(invitations, users, mailer);

    const invited = await invite.execute(command);

    expect(invited).toMatchObject({
      ok: true,
      value: {
        status: InvitationStatus.Pending,
        role: Role.Editor,
        email: "invitee@example.com",
      },
    });
  });

  it("one_mail_from_the_inviter_carries_a_token_that_opens_the_invitation", async () => {
    const invitations = new InMemoryInvitationRepository();
    const mailer = new RecordingInvitationMailer();
    const users = new InMemoryUserRepository();
    const invite = new InviteUser(invitations, users, mailer);

    const invited = await invite.execute(command);

    expect(mailer.sent).toHaveLength(1);
    const [sent] = mailer.sent;
    assert.exists(sent);
    const opened = await invitations.findByToken(sent.token);
    const invitationId = invited.ok ? invited.value.id : null;
    expect(sent.inviterName).toBe("Ada Admin");
    expect(sent.invitation.id).toBe(invitationId);
    expect(opened?.id).toBe(invitationId);
  });

  it("a_new_invitation_for_an_email_with_a_pending_one_revokes_the_previous", async () => {
    const previous = anInvitation({ role: Role.Viewer });
    const invitations = new InMemoryInvitationRepository(previous.invitation);
    const users = new InMemoryUserRepository();
    const mailer = new RecordingInvitationMailer();
    const invite = new InviteUser(invitations, users, mailer);

    const invited = await invite.execute(command);

    expect(previous.invitation.status).toBe(InvitationStatus.Revoked);
    const pending = await invitations.findPendingByEmail("invitee@example.com");
    const invitationId = invited.ok ? invited.value.id : null;
    expect(pending?.id).toBe(invitationId);
  });

  it("an_email_that_already_has_an_account_is_refused_and_nothing_is_sent", async () => {
    const invitations = new InMemoryInvitationRepository();
    const mailer = new RecordingInvitationMailer();
    const existing = aUser({ email: "invitee@example.com" });
    const users = new InMemoryUserRepository(existing);
    const invite = new InviteUser(invitations, users, mailer);

    const refused = await invite.execute(command);

    expect(refused).toEqual({
      ok: false,
      failure: InvitationRefusal.EmailTaken,
    });
    expect(invitations.invitations.size).toBe(0);
    expect(mailer.sent).toHaveLength(0);
  });
});
