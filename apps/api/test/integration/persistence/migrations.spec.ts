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

const ADMIN_EMAIL = "Owner@Example.COM";

const FIRST_ADMINISTRATOR = join(MIGRATIONS, "0034_first_administrator.sql");

const firstAdministrator = readFileSync(FIRST_ADMINISTRATOR, "utf8");

const seed = sql.raw(firstAdministrator);

const REFUSED = {
  cause: {
    code: "P0001",
    message: expect.stringContaining("set ADMIN_EMAIL") as unknown,
  },
};

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
  const db = drizzle({
    connection: {
      connectionString: url.toString(),
      options: `-c tenon.admin_email=${ADMIN_EMAIL}`,
    },
  });
  const unaddressed = drizzle({ connection: url.toString() });
  const migrations = { migrationsFolder: MIGRATIONS };

  beforeAll(async () => {
    await server.execute(sql.raw(`create database ${name}`));
  });

  afterAll(async () => {
    await db.$client.end();
    await unaddressed.$client.end();
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

  async function seedAfresh(address: string): Promise<unknown> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`truncate table "user" cascade`);
      await tx.execute(
        sql`select set_config('tenon.admin_email', ${address}, true)`,
      );
      await tx.execute(seed);
      const result = await tx.execute(sql`select email from "user"`);
      return result.rows;
    });
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

  it("the_first_administrator_is_seeded_once_from_the_address_the_migration_is_given", async () => {
    await migrate(db, migrations);
    await db.execute(seed);
    const result = await db.execute(
      sql`select email, name, role, status from "user"`,
    );

    expect(result.rows).toEqual([
      {
        email: "owner@example.com",
        name: "Administrator",
        role: "admin",
        status: "active",
      },
    ]);
  });

  it("a_database_with_an_administrator_needs_no_address", async () => {
    await migrate(db, migrations);
    await unaddressed.execute(seed);
    const result = await unaddressed.execute(sql`select email from "user"`);

    expect(result.rows).toEqual([{ email: "owner@example.com" }]);
  });

  it("an_address_with_spaces_and_capitals_is_stored_trimmed_and_lower_cased", async () => {
    await migrate(db, migrations);
    const emails = await seedAfresh("  Owner@Example.COM  ");

    expect(emails).toEqual([{ email: "owner@example.com" }]);
  });

  it("an_address_that_is_not_an_email_is_refused", async () => {
    await migrate(db, migrations);
    const seeding = seedAfresh("owner");

    await expect(seeding).rejects.toMatchObject(REFUSED);
  });
});

describe("a new database the migrations are given no administrator for", () => {
  const name = `first_administrator_${String(Date.now())}`;
  const server = drizzle({ connection: process.env.DATABASE_URL ?? "" });
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.pathname = `/${name}`;
  const unaddressed = drizzle({ connection: url.toString() });
  const emptied = drizzle({
    connection: {
      connectionString: url.toString(),
      options: "-c tenon.admin_email=",
    },
  });
  const migrations = { migrationsFolder: MIGRATIONS };

  beforeAll(async () => {
    await server.execute(sql.raw(`create database ${name}`));
  });

  afterAll(async () => {
    await unaddressed.$client.end();
    await emptied.$client.end();
    await server.execute(sql.raw(`drop database ${name}`));
    await server.$client.end();
  });

  it("is_not_migrated_without_an_address", async () => {
    const migrating = migrate(unaddressed, migrations);

    await expect(migrating).rejects.toMatchObject(REFUSED);
  });

  it("is_not_migrated_with_an_empty_address", async () => {
    const migrating = migrate(emptied, migrations);

    await expect(migrating).rejects.toMatchObject(REFUSED);
  });
});
