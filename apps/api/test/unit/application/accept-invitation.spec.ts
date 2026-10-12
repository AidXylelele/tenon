import { AcceptInvitation } from '../../../src/application/use-cases/accept-invitation.js';
import { VerifyInvitationLink } from '../../../src/application/use-cases/verify-invitation-link.js';
import {
  AccountType,
  InvitationStatus,
  Role,
} from '../../../src/domain/enums.js';
import {
  AccountExistsError,
  InvitationExpiredError,
  InvitationNotFoundError,
  InvitationRevokedError,
  InvitationUsedError,
} from '../../../src/domain/errors.js';
import { InvitationToken } from '../../../src/domain/invitation-token.js';
import {
  anInvitation,
  aUser,
  PASSWORD,
  passwords,
} from '../../support/builders.js';
import {
  InMemoryAccountRepository,
  InMemoryInvitationRepository,
  InMemoryUserRepository,
} from '../../support/fakes.js';

const accepting = (
  invitations: InMemoryInvitationRepository,
  users = new InMemoryUserRepository(),
  accounts = new InMemoryAccountRepository(),
) => new AcceptInvitation(invitations, users, accounts, passwords);

describe('AcceptInvitation and VerifyInvitationLink', () => {
  it('the_link_shows_who_is_invited_and_accepting_creates_the_user_with_the_role_and_a_password_account', async () => {
    const { invitation, token } = anInvitation({ role: Role.Editor });
    const invitations = new InMemoryInvitationRepository(invitation);
    const users = new InMemoryUserRepository();
    const accounts = new InMemoryAccountRepository();

    const verified = await new VerifyInvitationLink(invitations).execute(
      token.value,
    );
    expect(verified.email).toBe('invitee@example.com');

    const accepted = await accepting(invitations, users, accounts).execute({
      token: token.value,
      name: 'Newcomer',
      password: PASSWORD,
    });
    expect(accepted.user).toMatchObject({
      email: 'invitee@example.com',
      name: 'Newcomer',
      role: Role.Editor,
    });
    expect(await users.findByEmail('invitee@example.com')).toBe(accepted.user);
    const account = await accounts.findByIdentifier(
      AccountType.Password,
      'invitee@example.com',
    );
    expect(account?.userId).toBe(accepted.user.id);
    expect(
      await passwords.verify(PASSWORD, account?.passwordHash ?? null),
    ).toBe(true);
    expect(invitation.status).toBe(InvitationStatus.Accepted);
    expect(invitation.acceptedUserId).toBe(accepted.user.id);
  });

  it('a_used_revoked_or_expired_invitation_is_refused_with_its_reason', async () => {
    const used = anInvitation();
    used.invitation.accept('someone');
    const revoked = anInvitation();
    revoked.invitation.revoke();
    const expired = anInvitation();
    const invitations = new InMemoryInvitationRepository(
      used.invitation,
      revoked.invitation,
      expired.invitation,
    );
    const verify = new VerifyInvitationLink(invitations);

    await expect(verify.execute(used.token.value)).rejects.toBeInstanceOf(
      InvitationUsedError,
    );
    await expect(verify.execute(revoked.token.value)).rejects.toBeInstanceOf(
      InvitationRevokedError,
    );
    vi.useFakeTimers();
    vi.setSystemTime(expired.invitation.expiresAt);
    await expect(verify.execute(expired.token.value)).rejects.toBeInstanceOf(
      InvitationExpiredError,
    );
    vi.useRealTimers();
  });

  it('an_unknown_token_is_not_found', async () => {
    const invitations = new InMemoryInvitationRepository(
      anInvitation().invitation,
    );
    await expect(
      new VerifyInvitationLink(invitations).execute(
        InvitationToken.generate().value,
      ),
    ).rejects.toBeInstanceOf(InvitationNotFoundError);
  });

  it('an_invitation_whose_email_got_an_account_meanwhile_is_refused_and_stays_pending', async () => {
    const { invitation, token } = anInvitation();
    const invitations = new InMemoryInvitationRepository(invitation);
    const users = new InMemoryUserRepository(
      aUser({ email: 'invitee@example.com' }),
    );
    await expect(
      accepting(invitations, users).execute({
        token: token.value,
        name: 'Late',
        password: PASSWORD,
      }),
    ).rejects.toBeInstanceOf(AccountExistsError);
    expect(invitation.status).toBe(InvitationStatus.Pending);
    expect(users.users.size).toBe(1);
  });
});
