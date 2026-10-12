import { InvitationMail } from '../../../src/interface-adapters/mailing/templates/invitation.mail.js';
import { PasswordResetMail } from '../../../src/interface-adapters/mailing/templates/password-reset.mail.js';
import { Role } from '../../../src/domain/enums.js';
import { InvitationToken } from '../../../src/domain/invitation-token.js';

describe('mail templates', () => {
  it('the_invitation_mail_links_to_the_web_application_with_the_token_and_names_the_inviter_role_and_expiry', () => {
    const content = new InvitationMail('http://web.local').render({
      to: 'new@example.com',
      token: new InvitationToken('the-token'),
      inviterName: 'Ada <Admin>',
      role: Role.Editor,
      expiresAt: new Date('2026-10-18T10:00:00.000Z'),
    });
    expect(content.subject).toContain('Ada <Admin>');
    expect(content.text).toContain(
      'http://web.local/invitations/accept?token=the-token',
    );
    expect(content.text).toContain('editor');
    expect(content.text).toContain('2026-10-18 10:00 UTC');
    expect(String(content.html)).toContain(
      'href="http://web.local/invitations/accept?token=the-token"',
    );
    expect(String(content.html)).toContain('Ada &lt;Admin&gt;');
  });

  it('the_password_reset_mail_carries_the_link_and_the_expiry', () => {
    const content = new PasswordResetMail().render({
      to: 'user@example.com',
      link: 'http://web.local/reset-password?token=xyz',
      expiresAt: new Date('2026-10-11T11:00:00.000Z'),
    });
    expect(content.subject).toContain('Reset');
    expect(content.text).toContain('http://web.local/reset-password?token=xyz');
    expect(content.text).toContain('2026-10-11 11:00 UTC');
  });
});
