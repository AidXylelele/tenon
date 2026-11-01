import { ResolveSessionUser } from '../../../src/application/identity/resolve-session-user.js';
import { UserStatus } from '../../../src/domain/identity/enums.js';
import { aUser } from '../../support/builders.js';
import { InMemoryUserRepository } from '../../support/fakes.js';

describe('ResolveSessionUser', () => {
  it('a_session_of_an_active_user_yields_the_user', async () => {
    const user = aUser();
    const resolved = await new ResolveSessionUser(
      new InMemoryUserRepository(user),
    ).execute(user.id);
    expect(resolved).toBe(user);
  });

  it('a_session_of_a_suspended_or_unknown_user_yields_nobody', async () => {
    const suspended = aUser({ status: UserStatus.Suspended });
    const resolve = new ResolveSessionUser(
      new InMemoryUserRepository(suspended),
    );
    expect(await resolve.execute(suspended.id)).toBeNull();
    expect(await resolve.execute('someone-else')).toBeNull();
  });
});
