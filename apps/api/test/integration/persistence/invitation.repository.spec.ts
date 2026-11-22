import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { InvitationRepository } from "../../../src/application/identity/ports.js";
import { StaleWriteError } from "../../../src/domain/errors.js";
import type { Invitation } from "../../../src/domain/identity/invitation.js";
import { InvitationToken } from "../../../src/domain/identity/invitation-token.js";
import { invitation as invitationTable } from "../../../src/interface-adapters/persistence/schema/index.js";
import { Role } from "../../../src/domain/identity/enums.js";
import { anInvitation, anInvitee } from "../../support/builders.js";
import {
  addUser,
  createPersistenceTest,
  invitationRepository,
  type PersistenceTest,
  truncateUsersAndDependents,
  userRepository,
} from "../../support/create-persistence-test.js";

const now = new Date();

describe("PostgresInvitationRepository", () => {
  let t: PersistenceTest;
  let repository: InvitationRepository;
  let adminId: string;

  beforeAll(async () => {
    const bindings = [...userRepository, ...invitationRepository];
    t = await createPersistenceTest(bindings);
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

  const save = (invitation: Invitation) =>
    t.inTransaction(() => repository.save(invitation));

  const stored = async (email = "new@example.com") => {
    const issued = anInvitation({ email, invitedBy: adminId });
    await save(issued.invitation);
    return issued;
  };

  it("a_stored_invitation_is_read_back_by_its_id", async () => {
    const { invitation } = await stored();

    const found = await repository.find(invitation.id);
    assert.exists(found);

    const read = {
      id: found.id,
      email: found.email,
      role: found.role,
      status: found.status,
      invitedBy: found.invitedBy,
      expiresAt: found.expiresAt,
      version: found.version,
    };
    expect(read).toEqual({
      id: invitation.id,
      email: "new@example.com",
      role: "editor",
      status: "pending",
      invitedBy: adminId,
      expiresAt: invitation.expiresAt,
      version: 1,
    });
  });

  it("a_stored_invitation_is_read_back_by_the_token_from_its_link", async () => {
    const { invitation, token } = await stored();
    const fromLink = new InvitationToken(token.value);

    const found = await repository.findByToken(fromLink);
    assert.exists(found);

    const read = {
      id: found.id,
      email: found.email,
      role: found.role,
      status: found.status,
      invitedBy: found.invitedBy,
      expiresAt: found.expiresAt,
      version: found.version,
    };
    expect(read).toEqual({
      id: invitation.id,
      email: "new@example.com",
      role: "editor",
      status: "pending",
      invitedBy: adminId,
      expiresAt: invitation.expiresAt,
      version: 1,
    });
  });

  it("the_token_itself_is_never_stored_only_its_fingerprint", async () => {
    const { invitation, token } = await stored();

    const [row] = await t.db
      .select()
      .from(invitationTable)
      .where(eq(invitationTable.id, invitation.id));
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain(token.value);
    const tokenHash = row?.tokenHash;
    expect(tokenHash).toBe(token.hash);
  });

  it("an_unknown_id_finds_none", async () => {
    await stored();
    const unknownId = randomUUID();

    const found = await repository.find(unknownId);

    expect(found).toBeNull();
  });

  it("an_unknown_token_finds_none", async () => {
    await stored();
    const unknown = InvitationToken.generate();

    const found = await repository.findByToken(unknown);

    expect(found).toBeNull();
  });

  it("a_stale_copy_cannot_overwrite_a_change_made_through_another_copy", async () => {
    const { invitation } = await stored();
    const first = await repository.find(invitation.id);
    const second = await repository.find(invitation.id);
    assert.exists(first);
    assert.exists(second);
    first.accept(anInvitee(adminId), null, now);
    await save(first);
    second.revoke(now);

    const refused = save(second);

    await expect(refused).rejects.toBeInstanceOf(StaleWriteError);
    const current = await repository.find(invitation.id);
    expect(current?.status).toBe("accepted");
  });

  it("a_second_pending_invitation_for_one_email_is_refused_and_the_first_stays_pending", async () => {
    const { invitation } = await stored();

    const refused = stored();

    await expect(refused).rejects.toBeInstanceOf(StaleWriteError);
    const pending = await repository.findPendingByEmail("new@example.com");
    const pendingId = pending?.id;
    expect(pendingId).toBe(invitation.id);
  });

  it("revoking_the_pending_invitation_frees_its_email_for_a_new_one", async () => {
    const { invitation } = await stored();
    const current = await repository.find(invitation.id);
    assert.exists(current);
    current.revoke(now);

    await save(current);

    const pending = await repository.findPendingByEmail("new@example.com");
    expect(pending).toBeNull();
    const reissued = stored();
    await expect(reissued).resolves.toBeDefined();
  });
});
