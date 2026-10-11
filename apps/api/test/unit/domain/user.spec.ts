import { User } from '../../../src/domain/user.js';
import { aUser } from '../../support/builders.js';

describe('User', () => {
  it('only_the_administrator_role_is_an_administrator', () => {
    expect(aUser({ role: 'admin' }).isAdmin).toBe(true);
    expect(aUser({ role: 'editor' }).isAdmin).toBe(false);
    expect(aUser({ role: 'viewer' }).isAdmin).toBe(false);
  });

  it('a_created_user_is_active_and_gets_a_fresh_identity', () => {
    const user = User.create({
      email: 'new@example.com',
      name: 'New',
      role: 'editor',
      passwordHash: 'first',
    });
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.suspended).toBe(false);
    expect(user.role).toBe('editor');
  });

  it('changing_the_password_replaces_the_stored_hash', () => {
    const user = aUser({ passwordHash: 'first' });
    user.changePassword('second');
    expect(user.passwordHash).toBe('second');
  });
});
