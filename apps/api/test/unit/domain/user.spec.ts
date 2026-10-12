import { Role, UserStatus } from '../../../src/domain/enums.js';
import { User } from '../../../src/domain/user.js';
import { aUser } from '../../support/builders.js';

describe('User', () => {
  it('only_the_administrator_role_is_an_administrator', () => {
    expect(aUser({ role: Role.Admin }).isAdmin).toBe(true);
    expect(aUser({ role: Role.Editor }).isAdmin).toBe(false);
    expect(aUser({ role: Role.Viewer }).isAdmin).toBe(false);
  });

  it('a_created_user_is_active_and_gets_a_fresh_identity', () => {
    const user = User.create({
      email: 'new@example.com',
      name: 'New',
      role: Role.Editor,
    });
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.status).toBe(UserStatus.Active);
    expect(user.isActive).toBe(true);
    expect(user.role).toBe(Role.Editor);
  });

  it('a_suspended_user_is_not_active', () => {
    expect(aUser({ status: UserStatus.Suspended }).isActive).toBe(false);
  });
});
