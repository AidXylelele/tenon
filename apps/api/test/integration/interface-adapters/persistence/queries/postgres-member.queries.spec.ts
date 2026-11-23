import { eq } from "drizzle-orm";
import { InvitationRepository } from "../../../../../src/application/identity/invitations/ports.js";
import { MemberQueries } from "../../../../../src/application/identity/users/queries.js";
import type { Invitation } from "../../../../../src/domain/identity/invitations/invitation.js";
import {
  Role,
  UserStatus,
} from "../../../../../src/domain/identity/users/enums.js";
import {
  invitation as invitations,
  user as users,
} from "../../../../../src/interface-adapters/persistence/schema/index.js";
import { anInvitation } from "../../../../support/builders.js";
import {
  addUser,
  createPersistenceTest,
  invitationRepository,
  memberQueries,
  type PersistenceTest,
  truncateUsersAndDependents,
  userRepository,
} from "../../../../support/create-persistence-test.js";

const now = new Date();

describe("PostgresMemberQueries", () => {
  let t: PersistenceTest;
  let queries: MemberQueries;
  let repository: InvitationRepository;

  beforeAll(async () => {
    const bindings = [
      ...userRepository,
      ...invitationRepository,
      ...memberQueries,
    ];
    t = await createPersistenceTest(bindings);
    queries = t.module.get(MemberQueries);
    repository = t.module.get(InvitationRepository);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateUsersAndDependents(t.db);
  });

  const joined = async (email: string, role: Role, since: string) => {
    const user = await addUser(t, { email, name: email, role });
    const createdAt = new Date(since);
    await t.db.update(users).set({ createdAt }).where(eq(users.id, user.id));
    return user;
  };

  const invited = async (
    email: string,
    invitedBy: string,
    since: string,
    change: (invitation: Invitation) => void = () => undefined,
  ) => {
    const { invitation } = anInvitation({ email, invitedBy });
    change(invitation);
    await t.inTransaction(() => repository.save(invitation));
    const createdAt = new Date(since);
    await t.db
      .update(invitations)
      .set({ createdAt })
      .where(eq(invitations.id, invitation.id));
    return invitation;
  };

  it("lists_the_people_and_the_pending_invitations_oldest_first", async () => {
    const admin = await joined(
      "admin@example.com",
      Role.Admin,
      "2026-01-01T00:00:00Z",
    );
    const viewer = await joined(
      "viewer@example.com",
      Role.Viewer,
      "2026-01-03T00:00:00Z",
    );
    await t.db
      .update(users)
      .set({ status: UserStatus.Suspended })
      .where(eq(users.id, viewer.id));
    const pending = await invited(
      "new@example.com",
      admin.id,
      "2026-01-02T00:00:00Z",
    );

    const members = await queries.list();

    const listed = members.map((member) => [
      member.email,
      member.name,
      member.role,
      member.status,
    ]);
    expect(listed).toEqual([
      ["admin@example.com", "admin@example.com", "admin", "active"],
      ["new@example.com", null, "editor", "invited"],
      ["viewer@example.com", "viewer@example.com", "viewer", "suspended"],
    ]);
    expect(members[1]?.id).toBe(pending.id);
    expect(members[0]?.since).toEqual(new Date("2026-01-01T00:00:00Z"));
  });

  it("a_revoked_or_expired_invitation_is_no_member", async () => {
    const admin = await joined(
      "admin@example.com",
      Role.Admin,
      "2026-01-01T00:00:00Z",
    );
    await invited(
      "revoked@example.com",
      admin.id,
      "2026-01-02T00:00:00Z",
      (i) => {
        i.revoke(now);
      },
    );
    const expired = await invited(
      "expired@example.com",
      admin.id,
      "2026-01-03T00:00:00Z",
    );
    const aSecondAgo = Date.now() - 1_000;
    const pastItsExpiry = new Date(aSecondAgo);
    await t.db
      .update(invitations)
      .set({ expiresAt: pastItsExpiry })
      .where(eq(invitations.id, expired.id));

    const members = await queries.list();

    const emails = members.map((member) => member.email);
    expect(emails).toEqual(["admin@example.com"]);
  });
});
