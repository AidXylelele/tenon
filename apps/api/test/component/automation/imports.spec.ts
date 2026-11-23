import request from "supertest";
import { Role } from "../../../src/domain/identity/users/enums.js";
import { AddressPolicy } from "../../../src/frameworks/network/address-policy.js";
import { authHeaders, createUser, signIn } from "../../support/auth-helpers.js";
import { aDocument } from "../../support/builders.js";
import { createTestApp, type TestApp } from "../../support/create-test-app.js";
import { truncateAll } from "../../support/db.js";
import {
  createRunApp,
  drain,
  instanceOf,
  publish,
  publishing,
  resetRuns,
  start,
} from "../../support/run-helpers.js";
import { startStubServer, type StubServer } from "../../support/stub-server.js";

const FETCH = "/api/v1/imports/fetch";
const PROBLEM = "application/problem+json";
const FUNCTION = "input:\n  schema:\n    document:\n      type: object\n";
const GREETING = [
  "input:",
  "  schema:",
  "    document:",
  "      type: object",
  "      properties:",
  "        name:",
  "          type: string",
  "      required: [ name ]",
  "set:",
  '  greeting: ${ "hello " + .name }',
  "",
].join("\n");

describe("fetching an import's text for the editor over HTTP", () => {
  let t: TestApp;
  let catalog: StubServer;
  let author: Record<string, string>;
  let viewer: Record<string, string>;

  beforeAll(async () => {
    catalog = await startStubServer((received, response) => {
      if (received.url === "/private/function.yaml") {
        response.writeHead(401);
        response.end();
        return;
      }

      if (received.url === "/greet/function.yaml") {
        response.writeHead(200, { "content-type": "application/yaml" });
        response.end(GREETING);
        return;
      }

      if (received.url.endsWith("/function.yaml")) {
        response.writeHead(200, { "content-type": "application/yaml" });
        response.end(FUNCTION);
        return;
      }

      response.writeHead(404);
      response.end();
    });
    const policy = new AddressPolicy(["127.0.0.1"]);
    t = await createTestApp((builder) =>
      builder.overrideProvider(AddressPolicy).useValue(policy),
    );
  });

  afterAll(async () => {
    await t.close();
    await catalog.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    catalog.received.length = 0;
    await createUser(t, { email: "author@example.com", role: Role.Editor });
    await createUser(t, { email: "viewer@example.com", role: Role.Viewer });
    author = authHeaders(await signIn(t.server, "author@example.com"));
    viewer = authHeaders(await signIn(t.server, "viewer@example.com"));
  });

  it("an_author_gets_the_text_of_an_import", async () => {
    const fetched = await request(t.server)
      .post(FETCH)
      .set(author)
      .send({ uri: `${catalog.origin}/log/function.yaml` })
      .expect(200);

    expect(fetched.body).toEqual({ text: FUNCTION });
  });

  it("a_refused_or_unreachable_import_is_a_problem_naming_why", async () => {
    const refused = await request(t.server)
      .post(FETCH)
      .set(author)
      .send({ uri: `${catalog.origin}/private/function.yaml` })
      .expect(502);
    const missing = await request(t.server)
      .post(FETCH)
      .set(author)
      .send({ uri: `${catalog.origin}/none.yaml` })
      .expect(502);
    const internal = await request(t.server)
      .post(FETCH)
      .set(author)
      .send({ uri: "http://10.0.0.1/function.yaml" })
      .expect(502);

    expect(refused.headers["content-type"]).toContain(PROBLEM);
    expect(refused.body).toMatchObject({
      type: "urn:problem:import.rejected",
      status: 502,
      detail: "The server answered the resource with status 401",
    });
    expect(missing.body).toMatchObject({ type: "urn:problem:import.rejected" });
    expect(internal.body).toMatchObject({
      type: "urn:problem:import.unreachable",
      detail:
        "The address is private, loopback or link-local and not allow-listed",
    });
  });

  it("only_an_author_fetches_and_only_an_http_address", async () => {
    await request(t.server)
      .post(FETCH)
      .set(viewer)
      .send({ uri: `${catalog.origin}/log/function.yaml` })
      .expect(403);
    await request(t.server)
      .post(FETCH)
      .set(author)
      .send({ uri: "file:///etc/passwd" })
      .expect(400);
    await request(t.server)
      .post(FETCH)
      .send({ uri: `${catalog.origin}/log/function.yaml` })
      .expect(401);

    expect(catalog.received).toEqual([]);
  });
});

describe("a workflow that calls a function at a URI", () => {
  let t: TestApp;
  let catalog: StubServer;
  let author: Record<string, string>;

  beforeAll(async () => {
    catalog = await startStubServer((received, response) => {
      if (received.url === "/greet/function.yaml") {
        response.writeHead(200, { "content-type": "application/yaml" });
        response.end(GREETING);
        return;
      }

      response.writeHead(404);
      response.end();
    });
    const run = await createRunApp();
    t = run.t;
  });

  afterAll(async () => {
    await t.close();
    await catalog.close();
  });

  beforeEach(async () => {
    await resetRuns(t);
    await createUser(t, { email: "author@example.com", role: Role.Editor });
    author = authHeaders(await signIn(t.server, "author@example.com"));
  });

  it("is_published_with_the_function_text_it_imports_and_runs_it", async () => {
    const document = aDocument({ name: "greeter" }, [
      {
        greet: {
          call: `${catalog.origin}/greet/function.yaml`,
          with: { name: "ada" },
        },
      },
    ]);

    await publish(t, author, document);
    const started = await start(t, author, { input: {} }, "sales/greeter");
    await drain(t);
    const ended = await instanceOf(t, author, started.id);

    expect(ended.phase).toBe("completed");
    expect(ended.output).toEqual({ greeting: "hello ada" });
    expect(catalog.received.map((call) => call.url)).toEqual([
      "/greet/function.yaml",
    ]);
  });

  it("is_refused_at_its_call_when_the_host_cannot_fetch_the_function", async () => {
    const uri = `${catalog.origin}/missing/function.yaml`;
    const document = aDocument({ name: "lost" }, [{ greet: { call: uri } }]);

    const refused = await publishing(t, author, document);

    expect(refused.status).toBe(422);
    expect(refused.body).toMatchObject({
      errors: [
        {
          code: "unresolved-import",
          pointer: "/do/0/greet/call",
          detail: `Import '${uri}' could not be fetched: The server answered the resource with status 404`,
        },
      ],
    });
  });
});
