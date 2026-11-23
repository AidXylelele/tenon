import request from "supertest";
import { Role } from "../../../src/domain/identity/users/enums.js";
import { authHeaders, createUser, signIn } from "../../support/auth-helpers.js";
import {
  createTestApp,
  type TestApp,
  withoutInterpreter,
} from "../../support/create-test-app.js";
import { truncateAll } from "../../support/db.js";

describe("the members of the workspace over HTTP", () => {
  let t: TestApp;
  let admin: Record<string, string>;
  let editor: Record<string, string>;

  beforeAll(async () => {
    t = await createTestApp(withoutInterpreter);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    await createUser(t, {
      email: "admin@example.com",
      role: Role.Admin,
      name: "Ada Admin",
    });
    await createUser(t, { email: "editor@example.com", role: Role.Editor });
    admin = authHeaders(await signIn(t.server, "admin@example.com"));
    editor = authHeaders(await signIn(t.server, "editor@example.com"));
  });

  it("an_administrator_lists_the_people_with_role_and_status_and_the_invited", async () => {
    await request(t.server)
      .post("/api/v1/invitations")
      .set(admin)
      .send({ email: "new@example.com", role: "viewer" })
      .expect(201);

    const listed = await request(t.server)
      .get("/api/v1/members")
      .set(admin)
      .expect(200);

    expect(listed.body).toEqual([
      expect.objectContaining({
        email: "admin@example.com",
        name: "Ada Admin",
        role: "admin",
        status: "active",
      }),
      expect.objectContaining({ email: "editor@example.com", role: "editor" }),
      expect.objectContaining({
        email: "new@example.com",
        name: null,
        role: "viewer",
        status: "invited",
      }),
    ]);
  });

  it("only_an_administrator_reads_the_members", async () => {
    await request(t.server).get("/api/v1/members").set(editor).expect(403);
    await request(t.server).get("/api/v1/members").expect(401);
  });
});
