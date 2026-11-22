import { randomUUID } from "node:crypto";
import { UserRepository } from "../../../src/application/identity/ports.js";
import { Role, UserStatus } from "../../../src/domain/identity/enums.js";
import { StaleWriteError } from "../../../src/domain/errors.js";
import { User } from "../../../src/domain/identity/user.js";
import { suspendUser } from "../../support/auth-helpers.js";
import {
  addUser,
  createPersistenceTest,
  type PersistenceTest,
  truncateUsersAndDependents,
  userRepository,
} from "../../support/create-persistence-test.js";

const now = new Date();

describe("PostgresUserRepository", () => {
  let t: PersistenceTest;
  let repository: UserRepository;

  beforeAll(async () => {
    t = await createPersistenceTest(userRepository);
    repository = t.module.get(UserRepository);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateUsersAndDependents(t.db);
  });

  it("a_user_is_found_by_email_with_its_name_role_and_status", async () => {
    const created = await addUser(t, {
      email: "editor@example.com",
      name: "Ed Editor",
      role: Role.Editor,
    });

    const found = await repository.findByEmail("editor@example.com");

    const read = {
      id: found?.id,
      name: found?.name,
      role: found?.role,
      status: found?.status,
    };
    expect(read).toEqual({
      id: created.id,
      name: "Ed Editor",
      role: Role.Editor,
      status: UserStatus.Active,
    });
  });

  it("an_unknown_email_yields_null", async () => {
    await addUser(t, {
      email: "editor@example.com",
      name: "Ed Editor",
      role: Role.Editor,
    });

    const found = await repository.findByEmail("nobody@example.com");

    expect(found).toBeNull();
  });

  it("a_second_user_for_a_taken_email_is_refused_as_an_existing_account", async () => {
    await addUser(t, {
      email: "taken@example.com",
      name: "taken",
      role: Role.Viewer,
    });
    const duplicate = User.create({
      email: "taken@example.com",
      name: "Second Comer",
      role: Role.Viewer,
      now,
    });

    const refused = t.inTransaction(() => repository.add(duplicate));

    await expect(refused).rejects.toBeInstanceOf(StaleWriteError);
    const stored = await repository.findByEmail("taken@example.com");
    const storedName = stored?.name;
    expect(storedName).toBe("taken");
  });

  it("finding_a_suspended_user_by_id_reads_its_status", async () => {
    const user = await addUser(t, {
      email: "user@example.com",
      name: "User",
      role: Role.Viewer,
    });
    await suspendUser(t.db, user.id);

    const found = await repository.find(user.id);

    const status = found?.status;
    expect(status).toBe(UserStatus.Suspended);
  });

  it("finding_a_suspended_user_by_email_reads_its_status", async () => {
    const user = await addUser(t, {
      email: "user@example.com",
      name: "User",
      role: Role.Viewer,
    });
    await suspendUser(t.db, user.id);

    const found = await repository.findByEmail("user@example.com");

    const status = found?.status;
    expect(status).toBe(UserStatus.Suspended);
  });

  it("an_unknown_id_finds_nobody", async () => {
    await addUser(t, {
      email: "user@example.com",
      name: "User",
      role: Role.Viewer,
    });
    const unknownId = randomUUID();

    const found = await repository.find(unknownId);

    expect(found).toBeNull();
  });
});
