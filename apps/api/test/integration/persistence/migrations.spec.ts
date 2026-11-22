import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PostgresOutboxStore } from "@nestjs/outbox/postgres";
import { PostgresWorkflowStore } from "@nestjs/workflows/postgres";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const MIGRATIONS = fileURLToPath(new URL("../../../drizzle", import.meta.url));

const journal = JSON.parse(
  readFileSync(join(MIGRATIONS, "meta", "_journal.json"), "utf8"),
) as { entries: unknown[] };

interface Applied {
  readonly platform: number;
  readonly outbox: number;
  readonly engine: number;
}

describe("the migrations applied before the API starts", () => {
  const name = `migrations_${String(Date.now())}`;
  const server = drizzle({ connection: process.env.DATABASE_URL ?? "" });
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.pathname = `/${name}`;
  const db = drizzle({ connection: url.toString() });
  const migrations = { migrationsFolder: MIGRATIONS };

  beforeAll(async () => {
    await server.execute(sql.raw(`create database ${name}`));
  });

  afterAll(async () => {
    await db.$client.end();
    await server.execute(sql.raw(`drop database ${name}`));
    await server.$client.end();
  });

  async function applied(): Promise<Applied> {
    const result = await db.execute(sql`
      select
        (select count(*)::int from drizzle.__drizzle_migrations) as platform,
        (select max(version) from nest_outbox.migrations) as outbox,
        (select max(version) from nest_workflows.migrations) as engine
    `);
    const [row] = result.rows as unknown as Applied[];
    return row ?? { platform: 0, outbox: 0, engine: 0 };
  }

  it("an_empty_database_gets_the_platforms_the_outboxs_and_the_engines_migrations", async () => {
    await migrate(db, migrations);
    const state = await applied();

    expect(state).toEqual({
      platform: journal.entries.length,
      outbox: PostgresOutboxStore.schemaVersion,
      engine: PostgresWorkflowStore.schemaVersion,
    });
  });

  it("a_migrated_database_is_left_as_it_is", async () => {
    await migrate(db, migrations);
    const before = await applied();

    await migrate(db, migrations);
    const after = await applied();

    expect(after).toEqual(before);
  });
});
