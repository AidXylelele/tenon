import { UserRepository } from '../../../src/application/interfaces.js';
import { Role, UserStatus } from '../../../src/domain/enums.js';
import {
  AccountExistsError,
  UserNotFoundError,
} from '../../../src/domain/errors.js';
import { User } from '../../../src/domain/user.js';
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
      role: Role.Editor,
    });
    const found = await repository.findByEmail('Editor@Example.COM');
    expect(found?.id).toBe(created.id);
    expect(found?.name).toBe('Ed Editor');
    expect(found?.role).toBe(Role.Editor);
    expect(found?.status).toBe(UserStatus.Active);
    expect(await repository.findByEmail('nobody@example.com')).toBeNull();
  });

  it('a_second_user_for_a_taken_email_is_refused_as_an_existing_account', async () => {
    await createUser(t, { email: 'taken@example.com' });
    const duplicate = User.create({
      email: 'taken@example.com',
      name: 'Second Comer',
      role: Role.Viewer,
    });
    await expect(repository.add(duplicate)).rejects.toThrow(AccountExistsError);
    expect((await repository.findByEmail('taken@example.com'))?.name).toBe(
      'taken',
    );
  });

  it('active_lookups_leave_out_suspended_users_while_plain_lookups_still_find_them', async () => {
    const user = await createUser(t, { email: 'user@example.com' });
    expect((await repository.findActiveById(user.id))?.id).toBe(user.id);
    await suspendUser(t.db, user.id);
    expect(await repository.findActiveById(user.id)).toBeNull();
    expect(await repository.findActiveByEmail('user@example.com')).toBeNull();
    expect((await repository.findByEmail('user@example.com'))?.status).toBe(
      UserStatus.Suspended,
    );
    expect((await repository.getById(user.id)).isActive).toBe(false);
  });

  it('an_unknown_id_is_reported_as_not_found', async () => {
    await expect(
      repository.getById(crypto.randomUUID()),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
