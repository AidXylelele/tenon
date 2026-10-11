import { InviteUser } from '../../../src/application/use-cases/invite-user.js';
import { AccountExistsError } from '../../../src/domain/errors.js';
import { anInvitation, aUser } from '../../support/builders.js';
import {
  InMemoryInvitationRepository,
  InMemoryUserRepository,
  RecordingMailing,
} from '../../support/fakes.js';

const command = {
  email: 'invitee@example.com',
  role: 'editor' as const,
  invitedBy: 'admin-1',
  inviterName: 'Ada Admin',
};

describe('InviteUser', () => {
  it('creates_a_pending_invitation_and_emails_a_token_that_opens_it', async () => {
    const invitations = new InMemoryInvitationRepository();
    const mailing = new RecordingMailing();
    const invitation = await new InviteUser(
      invitations,
      new InMemoryUserRepository(),
      mailing,
    ).execute(command);
    expect(invitation.status).toBe('pending');
    expect(invitation.role).toBe('editor');
    expect(mailing.sent).toHaveLength(1);
    const [email] = mailing.sent;
    expect(email).toMatchObject({
      to: 'invitee@example.com',
      inviterName: 'Ada Admin',
      role: 'editor',
      expiresAt: invitation.expiresAt,
    });
    const opened = await invitations.getByToken(email!.token);
    expect(opened.id).toBe(invitation.id);
  });

  it('a_new_invitation_for_an_email_with_a_pending_one_revokes_the_previous', async () => {
    const previous = anInvitation({ role: 'viewer' });
    const invitations = new InMemoryInvitationRepository(previous.invitation);
    const invitation = await new InviteUser(
      invitations,
      new InMemoryUserRepository(),
      new RecordingMailing(),
    ).execute(command);
    expect(previous.invitation.status).toBe('revoked');
    expect(await invitations.findPendingByEmail('invitee@example.com')).toBe(
      invitation,
    );
  });

  it('an_email_that_already_has_an_account_is_refused_and_nothing_is_sent', async () => {
    const invitations = new InMemoryInvitationRepository();
    const mailing = new RecordingMailing();
    await expect(
      new InviteUser(
        invitations,
        new InMemoryUserRepository(aUser({ email: 'invitee@example.com' })),
        mailing,
      ).execute(command),
    ).rejects.toBeInstanceOf(AccountExistsError);
    expect(invitations.invitations.size).toBe(0);
    expect(mailing.sent).toHaveLength(0);
  });
});
