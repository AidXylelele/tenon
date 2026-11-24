import { UnitOfWork } from "../../../../src/application/unit-of-work.js";
import { UserRepository } from "../../../../src/application/identity/users/ports.js";
import { Role } from "../../../../src/domain/identity/users/enums.js";
import { User } from "../../../../src/domain/identity/users/user.js";
import {
  createPersistenceTest,
  type PersistenceTest,
  truncateUsersAndDependents,
  userRepository,
} from "../../../support/create-persistence-test.js";

const now = new Date();

describe("PostgresUnitOfWork", () => {
  let t: PersistenceTest;
  let unitOfWork: UnitOfWork;
  let users: UserRepository;

  beforeAll(async () => {
    t = await createPersistenceTest(userRepository);
    unitOfWork = t.module.get(UnitOfWork);
    users = t.module.get(UserRepository);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateUsersAndDependents(t.db);
  });

  const aUser = (): User =>
    User.create({
      email: "editor@example.com",
      name: "Ed Editor",
      role: Role.Editor,
      now,
    });

  it("the_writes_of_a_finished_work_are_committed", async () => {
    const user = aUser();

    await unitOfWork.run(() => users.add(user));

    const found = await users.find(user.id);
    const foundId = found?.id;
    expect(foundId).toBe(user.id);
  });

  it("the_writes_of_a_work_that_throws_are_rolled_back", async () => {
    const user = aUser();
    const failing = async (): Promise<void> => {
      await users.add(user);
      throw new Error("The work failed");
    };

    const run = unitOfWork.run(failing);

    await expect(run).rejects.toThrow("The work failed");
    const found = await users.find(user.id);
    expect(found).toBeNull();
  });

  it("a_nested_work_joins_the_outer_one_and_rolls_back_with_it", async () => {
    const user = aUser();
    const outer = async (): Promise<void> => {
      await unitOfWork.run(() => users.add(user));
      throw new Error("The outer work failed");
    };

    const run = unitOfWork.run(outer);

    await expect(run).rejects.toThrow("The outer work failed");
    const found = await users.find(user.id);
    expect(found).toBeNull();
  });

  it("the_value_of_the_work_is_returned", async () => {
    const answered = await unitOfWork.run(() => Promise.resolve(42));

    expect(answered).toBe(42);
  });
});
