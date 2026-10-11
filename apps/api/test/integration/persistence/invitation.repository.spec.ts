import { eq } from 'drizzle-orm';
import { InvitationRepository } from '../../../src/application/interfaces.js';
import {
  InvitationConflictError,
  InvitationNotFoundError,
} from '../../../src/domain/errors.js';
import { InvitationToken } from '../../../src/domain/invitation-token.js';
import { invitation as invitationTable } from '../../../src/interface-adapters/persistence/schema/index.js';
import { createUser } from '../../support/auth-helpers.js';
import { anInvitation } from '../../support/builders.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { truncateAll } from '../../support/db.js';

describe('DrizzleInvitationRepository', () => {
  let t: TestApp;
  let repository: InvitationRepository;
  let adminId: string;

  beforeAll(async () => {
    t = await createTestApp();
    repository = t.app.get(InvitationRepository);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    const admin = await createUser(t, {
      email: 'admin@example.com',
      role: 'admin',
    });
    adminId = admin.id;
  });

  const stored = async (email = 'new@example.com') => {
    const issued = anInvitation({ email, invitedBy: adminId });
    await repository.add(issued.invitation);
    return issued;
  };

  it('a_stored_invitation_is_read_back_by_id_and_by_the_token_from_its_link', async () => {
    const { invitation, token } = await stored();
    const byId = await repository.getById(invitation.id);
    const byToken = await repository.getByToken(
      new InvitationToken(token.value),
    );
    for (const found of [byId, byToken]) {
      expect(found.id).toBe(invitation.id);
      expect(found.email).toBe('new@example.com');
      expect(found.role).toBe('editor');
      expect(found.status).toBe('pending');
      expect(found.invitedBy).toBe(adminId);
      expect(found.expiresAt).toEqual(invitation.expiresAt);
    }
  });

  it('the_token_itself_is_never_stored_only_its_fingerprint', async () => {
    const { invitation, token } = await stored();
    const [row] = await t.db
      .select()
      .from(invitationTable)
      .where(eq(invitationTable.id, invitation.id));
    expect(JSON.stringify(row)).not.toContain(token.value);
    expect(row?.tokenHash).toBe(token.hash);
  });

  it('an_unknown_id_or_token_is_reported_as_not_found', async () => {
    await expect(
      repository.getById(crypto.randomUUID()),
    ).rejects.toBeInstanceOf(InvitationNotFoundError);
    await expect(
      repository.getByToken(InvitationToken.generate()),
    ).rejects.toBeInstanceOf(InvitationNotFoundError);
  });

  it('a_stale_copy_cannot_overwrite_a_change_made_through_another_copy', async () => {
    const { invitation } = await stored();
    const first = await repository.getById(invitation.id);
    const second = await repository.getById(invitation.id);
    first.accept(adminId);
    await repository.update(first);
    second.revoke();
    await expect(repository.update(second)).rejects.toBeInstanceOf(
      InvitationConflictError,
    );
    const current = await repository.getById(invitation.id);
    expect(current.status).toBe('accepted');
  });

  it('only_one_pending_invitation_per_email_can_exist_and_a_revoked_one_frees_the_email', async () => {
    const { invitation } = await stored();
    await expect(stored()).rejects.toThrow(InvitationConflictError);
    const pending = await repository.findPendingByEmail('new@example.com');
    expect(pending?.id).toBe(invitation.id);
    invitation.revoke();
    await repository.update(invitation);
    expect(await repository.findPendingByEmail('new@example.com')).toBeNull();
    await expect(stored()).resolves.toBeDefined();
  });
});
