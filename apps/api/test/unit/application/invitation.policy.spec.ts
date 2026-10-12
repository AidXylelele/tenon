import { InvitationPolicy } from '../../../src/application/policies/invitation.policy.js';
import { Role } from '../../../src/domain/enums.js';
import { aUser } from '../../support/builders.js';

describe('InvitationPolicy', () => {
  const policy = new InvitationPolicy();

  it('an_administrator_manages_invitations', () => {
    expect(policy.manage(aUser({ role: Role.Admin }))).toBe(true);
  });

  it('editors_viewers_and_guests_do_not', () => {
    expect(policy.manage(aUser({ role: Role.Editor }))).toBe(false);
    expect(policy.manage(aUser({ role: Role.Viewer }))).toBe(false);
    expect(policy.manage(null)).toBe(false);
  });
});
