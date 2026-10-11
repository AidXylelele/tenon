import { UserRepository } from '../../../src/application/interfaces.js';
import { UserNotFoundError } from '../../../src/domain/errors.js';
import { createUser, suspendUser } from '../../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { truncateAll } from '../../support/db.js';

describe('DrizzleUserRepository', () => {
  let t: TestApp;
  let repository: UserRepository;

  beforeAll(async () => {
    t = await createTestApp();
    repository = t.app.get(UserRepository);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
  });

  it('a_user_is_found_by_email_regardless_of_case_and_an_unknown_email_yields_null', async () => {
    const created = await createUser(t, {
      email: 'editor@example.com',
      name: 'Ed Editor',
      role: 'editor',
    });
    const found = await repository.findByEmail('Editor@Example.COM');
    expect(found?.id).toBe(created.id);
    expect(found?.name).toBe('Ed Editor');
    expect(found?.role).toBe('editor');
    expect(await repository.findByEmail('nobody@example.com')).toBeNull();
  });

  it('active_lookups_leave_out_suspended_users_while_plain_lookups_still_find_them', async () => {
    const user = await createUser(t, { email: 'user@example.com' });
    expect((await repository.findActiveById(user.id))?.id).toBe(user.id);
    await suspendUser(t.db, user.id);
    expect(await repository.findActiveById(user.id)).toBeNull();
    expect(await repository.findActiveByEmail('user@example.com')).toBeNull();
    expect((await repository.findByEmail('user@example.com'))?.suspended).toBe(
      true,
    );
    expect((await repository.getById(user.id)).suspended).toBe(true);
  });

  it('an_unknown_id_is_reported_as_not_found', async () => {
    await expect(
      repository.getById(crypto.randomUUID()),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('a_changed_password_hash_is_read_back', async () => {
    const user = await createUser(t, { email: 'user@example.com' });
    user.changePassword('new-hash');
    await repository.update(user);
    expect((await repository.getById(user.id)).passwordHash).toBe('new-hash');
  });
});
