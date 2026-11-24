import { getDrizzleToken } from "@nestjs/drizzle";
import type { Pool } from "pg";
import type { Database } from "../../../../src/interface-adapters/persistence/interfaces.js";
import { createPersistenceTest } from "../../../support/create-persistence-test.js";

describe("the database pool", () => {
  afterEach(() => {
    delete process.env.DATABASE_POOL_MIN;
  });

  it("opens_its_minimum_of_connections_before_the_application_serves", async () => {
    process.env.DATABASE_POOL_MIN = "3";

    const test = await createPersistenceTest([]);
    const token = getDrizzleToken();
    const db = test.module.get<Database & { $client: Pool }>(token);
    const opened = db.$client.totalCount;
    const idle = db.$client.idleCount;
    await test.close();

    expect(opened).toBe(3);
    expect(idle).toBe(3);
  });
});
