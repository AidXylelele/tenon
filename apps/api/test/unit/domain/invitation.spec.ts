import {
  InvitationRefusal,
  InvitationStatus,
  Role,
} from "../../../src/domain/identity/enums.js";
import { Invitation } from "../../../src/domain/identity/invitation.js";
import { InvitationToken } from "../../../src/domain/identity/invitation-token.js";
import { anInvitation, anInvitee, aUser } from "../../support/builders.js";

const created = new Date("2026-10-11T10:00:00.000Z");
const accepted = { ok: true, value: undefined };

describe("Invitation", () => {
  it("a_new_invitation_is_pending_and_expires_seven_days_after_creation", () => {
    const { invitation } = anInvitation({}, created);

    expect(invitation.status).toBe(InvitationStatus.Pending);
    const expiry = invitation.expiresAt.toISOString();
    expect(expiry).toBe("2026-10-18T10:00:00.000Z");
  });

  it("the_invitation_keeps_the_fingerprint_of_the_token_and_not_the_token_itself", () => {
    const { invitation, token } = anInvitation({}, created);

    expect(invitation.tokenHash).toBe(token.hash);
    expect(invitation.tokenHash).not.toBe(token.value);
  });

  it("an_email_that_already_has_a_user_is_not_invited", () => {
    const holder = aUser({ email: "invitee@example.com" });

    const refused = Invitation.create({
      email: "invitee@example.com",
      role: Role.Editor,
      invitedBy: "admin-1",
      token: InvitationToken.generate(),
      holder,
      now: created,
    });

    expect(refused).toEqual({
      ok: false,
      failure: InvitationRefusal.EmailTaken,
    });
  });

  it("accepting_before_expiry_records_the_moment_and_the_user", () => {
    const { invitation } = anInvitation({}, created);
    const at = new Date("2026-10-15T08:00:00.000Z");

    const result = invitation.accept(anInvitee("user-9"), null, at);

    expect(result).toEqual(accepted);
    expect(invitation.status).toBe(InvitationStatus.Accepted);
    expect(invitation.acceptedAt).toBe(at);
    expect(invitation.acceptedUserId).toBe("user-9");
  });

  it("accepting_at_the_expiry_moment_is_refused_because_expiry_is_exclusive", () => {
    const { invitation } = anInvitation({}, created);
    const expiry = invitation.expiresAt;

    const result = invitation.accept(anInvitee("user-9"), null, expiry);

    expect(result).toEqual({ ok: false, failure: InvitationRefusal.Expired });
    expect(invitation.status).toBe(InvitationStatus.Pending);
  });

  it("a_pending_invitation_is_not_expired_one_millisecond_before_the_moment", () => {
    const { invitation } = anInvitation({}, created);
    const oneMillisecondEarlier = invitation.expiresAt.getTime() - 1;
    const before = new Date(oneMillisecondEarlier);

    expect(invitation.pendingAt(before)).toEqual(accepted);
  });

  it("accepting_for_an_email_that_got_a_user_meanwhile_is_refused_and_it_stays_pending", () => {
    const { invitation } = anInvitation({}, created);
    const holder = anInvitee("someone-earlier");

    const result = invitation.accept(anInvitee("user-9"), holder, created);

    expect(result).toEqual({
      ok: false,
      failure: InvitationRefusal.EmailTaken,
    });
    expect(invitation.status).toBe(InvitationStatus.Pending);
  });

  it("a_second_acceptance_is_refused_as_accepted_and_the_first_user_is_kept", () => {
    const { invitation } = anInvitation({}, created);
    invitation.accept(anInvitee("user-9"), null, created);

    const result = invitation.accept(anInvitee("user-10"), null, created);

    expect(result).toEqual({
      ok: false,
      failure: InvitationRefusal.Accepted,
    });
    expect(invitation.acceptedUserId).toBe("user-9");
  });

  it("revoking_a_pending_invitation_records_the_moment", () => {
    const { invitation } = anInvitation({}, created);
    const revoked = new Date("2026-10-12T00:00:00.000Z");

    const result = invitation.revoke(revoked);

    expect(result).toEqual(accepted);
    expect(invitation.status).toBe(InvitationStatus.Revoked);
    expect(invitation.revokedAt).toBe(revoked);
  });

  it("an_expired_invitation_can_still_be_revoked", () => {
    const { invitation } = anInvitation({}, created);
    const revoked = new Date("2026-11-01T00:00:00.000Z");

    invitation.revoke(revoked);

    expect(invitation.status).toBe(InvitationStatus.Revoked);
  });

  it("revoking_an_accepted_invitation_is_refused_as_accepted", () => {
    const { invitation } = anInvitation({}, created);
    invitation.accept(anInvitee("user-9"), null, created);

    const result = invitation.revoke(created);

    expect(result).toEqual({
      ok: false,
      failure: InvitationRefusal.Accepted,
    });
    expect(invitation.status).toBe(InvitationStatus.Accepted);
  });

  it("revoking_twice_is_refused_as_revoked", () => {
    const { invitation } = anInvitation({}, created);
    invitation.revoke(created);

    const result = invitation.revoke(created);

    expect(result).toEqual({ ok: false, failure: InvitationRefusal.Revoked });
  });

  it("accepting_a_revoked_invitation_is_refused_as_revoked", () => {
    const { invitation } = anInvitation({}, created);
    invitation.revoke(created);

    const result = invitation.accept(anInvitee("user-9"), null, created);

    expect(result).toEqual({ ok: false, failure: InvitationRefusal.Revoked });
  });
});
