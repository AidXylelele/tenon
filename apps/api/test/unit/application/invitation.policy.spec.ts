import { InvitationPolicy } from '../../../src/application/policies/invitation.policy.js';
import { aUser } from '../../support/builders.js';

describe('InvitationPolicy', () => {
  const policy = new InvitationPolicy();

  it('an_administrator_manages_invitations', () => {
    expect(policy.manage(aUser({ role: 'admin' }))).toBe(true);
  });

  it('editors_viewers_and_guests_do_not', () => {
    expect(policy.manage(aUser({ role: 'editor' }))).toBe(false);
    expect(policy.manage(aUser({ role: 'viewer' }))).toBe(false);
    expect(policy.manage(null)).toBe(false);
  });
});
