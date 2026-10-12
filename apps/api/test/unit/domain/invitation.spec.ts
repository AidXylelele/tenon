import { InvitationStatus } from '../../../src/domain/enums.js';
import {
  InvitationExpiredError,
  InvitationRevokedError,
  InvitationUsedError,
} from '../../../src/domain/errors.js';
import { anInvitation } from '../../support/builders.js';

describe('Invitation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a_new_invitation_is_pending_and_expires_seven_days_after_creation', () => {
    const { invitation } = anInvitation();
    expect(invitation.status).toBe(InvitationStatus.Pending);
    expect(invitation.expiresAt.toISOString()).toBe('2026-10-18T10:00:00.000Z');
  });

  it('the_invitation_keeps_the_fingerprint_of_the_token_and_not_the_token_itself', () => {
    const { invitation, token } = anInvitation();
    expect(invitation.tokenHash).toBe(token.hash);
    expect(invitation.tokenHash).not.toBe(token.value);
  });

  it('accepting_before_expiry_records_the_moment_and_the_user', () => {
    const { invitation } = anInvitation();
    vi.setSystemTime(new Date('2026-10-15T08:00:00.000Z'));
    invitation.accept('user-9');
    expect(invitation.status).toBe(InvitationStatus.Accepted);
    expect(invitation.acceptedAt?.toISOString()).toBe(
      '2026-10-15T08:00:00.000Z',
    );
    expect(invitation.acceptedUserId).toBe('user-9');
  });

  it('accepting_at_the_expiry_moment_is_refused_because_expiry_is_exclusive', () => {
    const { invitation } = anInvitation();
    vi.setSystemTime(invitation.expiresAt);
    expect(invitation.isExpired()).toBe(true);
    expect(() => invitation.accept('user-9')).toThrow(InvitationExpiredError);
    expect(invitation.status).toBe(InvitationStatus.Pending);
  });

  it('a_pending_invitation_is_not_expired_one_millisecond_before_the_moment', () => {
    const { invitation } = anInvitation();
    vi.setSystemTime(new Date(invitation.expiresAt.getTime() - 1));
    expect(invitation.isExpired()).toBe(false);
  });

  it('a_second_acceptance_is_refused_as_used_and_the_first_user_is_kept', () => {
    const { invitation } = anInvitation();
    invitation.accept('user-9');
    expect(() => invitation.accept('user-10')).toThrow(InvitationUsedError);
    expect(invitation.acceptedUserId).toBe('user-9');
  });

  it('revoking_a_pending_invitation_records_the_moment', () => {
    const { invitation } = anInvitation();
    vi.setSystemTime(new Date('2026-10-12T00:00:00.000Z'));
    invitation.revoke();
    expect(invitation.status).toBe(InvitationStatus.Revoked);
    expect(invitation.revokedAt?.toISOString()).toBe(
      '2026-10-12T00:00:00.000Z',
    );
  });

  it('an_expired_invitation_can_still_be_revoked', () => {
    const { invitation } = anInvitation();
    vi.setSystemTime(new Date('2026-11-01T00:00:00.000Z'));
    invitation.revoke();
    expect(invitation.status).toBe(InvitationStatus.Revoked);
  });

  it('revoking_an_accepted_invitation_is_refused_as_used', () => {
    const { invitation } = anInvitation();
    invitation.accept('user-9');
    expect(() => invitation.revoke()).toThrow(InvitationUsedError);
    expect(invitation.status).toBe(InvitationStatus.Accepted);
  });

  it('revoking_twice_is_refused_as_revoked', () => {
    const { invitation } = anInvitation();
    invitation.revoke();
    expect(() => invitation.revoke()).toThrow(InvitationRevokedError);
  });

  it('accepting_a_revoked_invitation_is_refused_as_revoked', () => {
    const { invitation } = anInvitation();
    invitation.revoke();
    expect(() => invitation.accept('user-9')).toThrow(InvitationRevokedError);
  });
});
