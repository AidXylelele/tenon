import { eq } from 'drizzle-orm';
import {
  InvitationQueries,
  InvitationRepository,
} from '../../../src/application/interfaces.js';
import type { Invitation } from '../../../src/domain/invitation.js';
import { invitation as invitationTable } from '../../../src/interface-adapters/persistence/schema/index.js';
import { Role } from '../../../src/domain/enums.js';
import { createUser } from '../../support/auth-helpers.js';
import { anInvitation } from '../../support/builders.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { truncateAll } from '../../support/db.js';

describe('DrizzleInvitationQueries', () => {
  let t: TestApp;
  let queries: InvitationQueries;
  let repository: InvitationRepository;
  let adminId: string;

  beforeAll(async () => {
    t = await createTestApp();
    queries = t.app.get(InvitationQueries);
    repository = t.app.get(InvitationRepository);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    const admin = await createUser(t, {
      email: 'admin@example.com',
      role: Role.Admin,
    });
    adminId = admin.id;
  });

  const stored = async (
    email: string,
    createdAt: string,
    change: (invitation: Invitation) => void = () => undefined,
  ): Promise<Invitation> => {
    const { invitation } = anInvitation({ email, invitedBy: adminId });
    change(invitation);
    await repository.add(invitation);
    await t.db
      .update(invitationTable)
      .set({ createdAt: new Date(createdAt) })
      .where(eq(invitationTable.id, invitation.id));
    return invitation;
  };

  it('lists_pending_invitations_oldest_first_and_leaves_out_accepted_revoked_and_expired_ones', async () => {
    const later = await stored('later@example.com', '2026-10-02T00:00:00Z');
    const earlier = await stored('earlier@example.com', '2026-10-01T00:00:00Z');
    await stored('accepted@example.com', '2026-10-01T00:00:00Z', (i) => {
      i.accept(adminId);
    });
    await stored('revoked@example.com', '2026-10-01T00:00:00Z', (i) => {
      i.revoke();
    });
    const expired = await stored('expired@example.com', '2026-10-01T00:00:00Z');
    await t.db
      .update(invitationTable)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(invitationTable.id, expired.id));

    const pending = await queries.listPending();
    expect(pending.map((row) => row.email)).toEqual([
      'earlier@example.com',
      'later@example.com',
    ]);
    expect(pending[0]).toMatchObject({
      id: earlier.id,
      role: 'editor',
      expiresAt: earlier.expiresAt,
    });
    expect(pending[1]?.id).toBe(later.id);
  });

  it('an_empty_table_yields_an_empty_list', async () => {
    expect(await queries.listPending()).toEqual([]);
  });
});
