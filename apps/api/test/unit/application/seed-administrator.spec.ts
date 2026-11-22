import { SeedAdministrator } from "../../../src/application/identity/seed-administrator.js";
import { Role } from "../../../src/domain/identity/enums.js";
import { aUser } from "../../support/builders.js";
import { InMemoryUserRepository } from "../../support/fakes.js";

describe("seeding the first administrator", () => {
  it("creates_one_administrator_with_the_configured_address", async () => {
    const users = new InMemoryUserRepository();
    const seed = new SeedAdministrator(users);

    await seed.execute({ email: "owner@example.com" });

    const seeded = [...users.users.values()];
    expect(seeded.map((user) => [user.email, user.role])).toEqual([
      ["owner@example.com", Role.Admin],
    ]);
  });

  it("does_nothing_while_an_administrator_exists", async () => {
    const admin = aUser({ email: "admin@example.com", role: Role.Admin });
    const users = new InMemoryUserRepository(admin);
    const seed = new SeedAdministrator(users);

    await seed.execute({ email: "owner@example.com" });

    expect([...users.users.values()]).toEqual([admin]);
  });
});
