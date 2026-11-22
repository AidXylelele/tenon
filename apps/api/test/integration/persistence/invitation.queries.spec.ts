import { eq } from "drizzle-orm";
import { InvitationRepository } from "../../../src/application/identity/invitations/ports.js";
import { InvitationQueries } from "../../../src/application/identity/invitations/queries.js";
import type { Invitation } from "../../../src/domain/identity/invitations/invitation.js";
import { invitation as invitationTable } from "../../../src/interface-adapters/persistence/schema/index.js";
import { Role } from "../../../src/domain/identity/users/enums.js";
import { anInvitation, anInvitee } from "../../support/builders.js";
import {
  addUser,
  createPersistenceTest,
  invitationQueries,
  invitationRepository,
  type PersistenceTest,
  truncateUsersAndDependents,
  userRepository,
} from "../../support/create-persistence-test.js";

const now = new Date();

describe("PostgresInvitationQueries", () => {
  let t: PersistenceTest;
  let queries: InvitationQueries;
  let repository: InvitationRepository;
  let adminId: string;

  beforeAll(async () => {
    const bindings = [
      ...userRepository,
      ...invitationRepository,
      ...invitationQueries,
    ];
    t = await createPersistenceTest(bindings);
    queries = t.module.get(InvitationQueries);
    repository = t.module.get(InvitationRepository);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateUsersAndDependents(t.db);
    const admin = await addUser(t, {
      email: "admin@example.com",
      name: "Admin",
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
    await t.inTransaction(() => repository.save(invitation));
    const created = new Date(createdAt);
    await t.db
      .update(invitationTable)
      .set({ createdAt: created })
      .where(eq(invitationTable.id, invitation.id));
    return invitation;
  };

  it("lists_every_invitation_oldest_first_with_what_became_of_it", async () => {
    const later = await stored("later@example.com", "2026-10-04T00:00:00Z");
    const earlier = await stored("earlier@example.com", "2026-10-01T00:00:00Z");
    await stored("accepted@example.com", "2026-10-02T00:00:00Z", (i) => {
      i.accept(anInvitee(adminId), null, now);
    });
    await stored("revoked@example.com", "2026-10-03T00:00:00Z", (i) => {
      i.revoke(now);
    });
    const expired = await stored("expired@example.com", "2026-10-05T00:00:00Z");
    const aSecondAgo = Date.now() - 1_000;
    const pastItsExpiry = new Date(aSecondAgo);
    await t.db
      .update(invitationTable)
      .set({ expiresAt: pastItsExpiry })
      .where(eq(invitationTable.id, expired.id));

    const listed = await queries.list();

    const outcomes = listed.map((row) => [row.email, row.outcome]);
    expect(outcomes).toEqual([
      ["earlier@example.com", "pending"],
      ["accepted@example.com", "accepted"],
      ["revoked@example.com", "revoked"],
      ["later@example.com", "pending"],
      ["expired@example.com", "expired"],
    ]);
    expect(listed[0]).toMatchObject({
      id: earlier.id,
      role: "editor",
      expiresAt: earlier.expiresAt,
    });
    expect(listed[3]?.id).toBe(later.id);
  });

  it("an_empty_table_yields_an_empty_list", async () => {
    const listed = await queries.list();

    expect(listed).toEqual([]);
  });
});
