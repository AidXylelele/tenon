import { createHmac } from "node:crypto";
import type { ServerResponse } from "node:http";
import { gzipSync } from "node:zlib";
import type { INestApplicationContext } from "@nestjs/common";
import { ResilienceService } from "@nestjs/resilience";
import { Test } from "@nestjs/testing";
import type {
  Authentication,
  HttpRequest,
  JsonObject,
  OpenApiRequest,
  ResourceRequest,
} from "interpreter";
import { ResilienceModule } from "@nestjs/resilience";
import { resiliencePresets } from "../../../../../src/frameworks/di/host.presets.js";
import { AddressPolicy } from "../../../../../src/frameworks/network/address-policy.js";
import { TransportFailures } from "../../../../../src/interface-adapters/workflows/effects/transport-failures.js";
import type { HttpGateway } from "../../../../../src/interface-adapters/workflows/effects/http.gateway.js";
import type { CallContext } from "../../../../../src/interface-adapters/workflows/effects/interfaces.js";
import { OpenApiGateway } from "../../../../../src/interface-adapters/workflows/effects/openapi.gateway.js";
import type { ResourceGateway } from "../../../../../src/interface-adapters/workflows/effects/resource.gateway.js";
import {
  closedPort,
  type ReceivedRequest,
  startStubServer,
  type StubServer,
} from "../../../../support/stub-server.js";
import {
  callContextOf,
  httpGatewayOf,
  resourcesOf,
  SELF_SIGNED,
  trustingIdentityProvider,
} from "../../../../support/outbound.js";

type OAuth2Properties = Omit<
  Extract<Authentication, { kind: "oauth2" | "oidc" }>,
  "kind"
>;

const TOKEN = "token-1";
const BASIC = `Basic ${Buffer.from("ada:lovelace").toString("base64")}`;
const REFUSED_ADDRESS =
  "The address is private, loopback or link-local and not allow-listed";
const ISSUER = "https://issuer.test";
const JWT_TOKEN = [
  Buffer.from('{"alg":"none"}').toString("base64url"),
  Buffer.from(`{"iss":"${ISSUER}","sub":"runtime"}`).toString("base64url"),
  "signature",
].join(".");
const OVERSIZED = "The response is larger than 1 MiB";
const BOMB = gzipSync(Buffer.alloc(2 * 1024 * 1024));

describe("a call the HTTP gateways perform for a run", () => {
  let context: INestApplicationContext;
  let resilience: ResilienceService;
  let policy: AddressPolicy;
  let gateway: HttpGateway;
  let openApi: OpenApiGateway;
  let resources: ResourceGateway;
  let stub: StubServer;
  let idp: StubServer;
  let origin = "";
  let authority = "";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule.forRoot({ presets: resiliencePresets })],
    }).compile();
    context = await moduleRef.init();
    resilience = context.get(ResilienceService);
    policy = new AddressPolicy(["127.0.0.1"]);
    const identity = trustingIdentityProvider();
    gateway = httpGatewayOf(policy, resilience, identity);
    resources = resourcesOf(policy, resilience, identity);
    openApi = new OpenApiGateway(
      resources,
      gateway,
      new TransportFailures(),
      resilience,
    );
    stub = await startStubServer((request, response) => {
      answer(request, response);
    });
    origin = stub.origin;
    idp = await startStubServer((request, response) => {
      issue(request, response);
    }, SELF_SIGNED);
    authority = idp.origin;
  });

  afterAll(async () => {
    await stub.close();
    await idp.close();
    await policy.onApplicationShutdown();
    await context.close();
  });

  beforeEach(() => {
    stub.received.length = 0;
    idp.received.length = 0;
  });

  function issue(request: ReceivedRequest, response: ServerResponse): void {
    const path = new URL(request.url, authority).pathname;

    if (path === "/oauth2/token" || path === "/realms/x/token") {
      json(response, 200, { access_token: TOKEN, token_type: "Bearer" });
      return;
    }

    if (path === "/issuing/oauth2/token") {
      json(response, 200, { access_token: JWT_TOKEN, token_type: "Bearer" });
      return;
    }

    if (path === "/refusing/oauth2/token") {
      json(response, 400, { error: "invalid_client" });
      return;
    }

    if (path === "/realms/x/.well-known/openid-configuration") {
      json(response, 200, {
        issuer: `${authority}/realms/x`,
        token_endpoint: `${authority}/realms/x/token`,
      });
      return;
    }

    if (path === "/realms/jwt/.well-known/openid-configuration") {
      json(response, 200, {
        issuer: `${authority}/realms/jwt`,
        token_endpoint: `${authority}/issuing/oauth2/token`,
      });
      return;
    }

    if (path === "/realms/bare/.well-known/openid-configuration") {
      json(response, 200, { issuer: `${authority}/realms/bare` });
      return;
    }

    response.writeHead(404).end();
  }

  function answer(request: ReceivedRequest, response: ServerResponse): void {
    const path = new URL(request.url, origin).pathname;
    const authorization = request.headers.authorization ?? "";

    if (path === "/json") {
      json(response, 200, { id: 1, name: "Rex" });
      return;
    }

    if (path === "/text") {
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("hello");
      return;
    }

    if (path === "/latin1") {
      response.writeHead(200, {
        "content-type": "text/plain; charset=iso-8859-1",
      });
      response.end(Buffer.from([0x63, 0x61, 0x66, 0xe9]));
      return;
    }

    if (path === "/binary") {
      response.writeHead(200, { "content-type": "application/octet-stream" });
      response.end(Buffer.from([0, 1, 2, 255]));
      return;
    }

    if (path === "/empty") {
      response.writeHead(204).end();
      return;
    }

    if (path === "/missing") {
      json(response, 404, { error: "no pet" });
      return;
    }

    if (path === "/moved") {
      response.writeHead(302, { location: "/json" }).end();
      return;
    }

    if (path === "/large") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("x".repeat(2 * 1024 * 1024));
      return;
    }

    if (path === "/bomb") {
      response.writeHead(200, {
        "content-type": "text/plain",
        "content-encoding": "gzip",
      });
      response.end(BOMB);
      return;
    }

    if (path === "/escape") {
      response.writeHead(302, { location: "http://169.254.169.254/latest" });
      response.end();
      return;
    }

    if (path === "/cookies") {
      response.writeHead(204, { "set-cookie": ["a=1; Path=/", "b=2; Path=/"] });
      response.end();
      return;
    }

    if (path === "/typed") {
      const type = new URL(request.url, origin).searchParams.get("as") ?? "";
      response.writeHead(200, { "content-type": type });
      response.end('{"a":1}');
      return;
    }

    if (path === "/hang") return;

    if (path === "/basic" && authorization !== BASIC) {
      response.writeHead(401, { "www-authenticate": 'Basic realm="pets"' });
      response.end();
      return;
    }

    if (path === "/protected" && authorization !== `Bearer ${TOKEN}`) {
      response.writeHead(401).end();
      return;
    }

    if (path === "/private/swagger.json" && authorization !== BASIC) {
      response.writeHead(401).end();
      return;
    }

    if (path === "/v2/swagger.json" || path === "/private/swagger.json") {
      json(response, 200, swaggerDocument(stub.port));
      return;
    }

    if (path === "/v3/openapi.json") {
      json(response, 200, openApiDocument(stub.port));
      return;
    }

    if (path === "/v3/openapi.yaml") {
      response.writeHead(200, { "content-type": "application/yaml" });
      response.end(YAML_DOCUMENT);
      return;
    }

    if (path === "/v3/broken.json") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{ "openapi": ');
      return;
    }

    if (path === "/script.js") {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end("console.log(1);");
      return;
    }

    json(response, 200, {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
    });
  }

  function contextOf(
    secrets: JsonObject = {},
    remaining: number | null = null,
  ): CallContext {
    return callContextOf("run-1/do/0/charge", secrets, remaining);
  }

  function httpOf(
    path: string,
    authentication: Authentication | null = null,
    output: HttpRequest["output"] = "content",
  ): HttpRequest {
    return {
      kind: "http",
      method: "GET",
      endpoint: { uri: `${origin}${path}`, authentication },
      headers: {},
      body: null,
      output,
      revealAuthorization: true,
    };
  }

  function oauth2Of(
    properties: Partial<OAuth2Properties> = {},
  ): Authentication {
    return {
      kind: "oauth2",
      authority,
      endpoints: {
        token: "/oauth2/token",
        revocation: "/oauth2/revoke",
        introspection: "/oauth2/introspect",
      },
      grant: "client_credentials",
      client: {
        id: "workflow-runtime",
        secret: "s3cret",
        assertion: null,
        authentication: "client_secret_post",
      },
      encoding: "application/x-www-form-urlencoded",
      issuers: [],
      scopes: [],
      audiences: [],
      username: null,
      password: null,
      subject: null,
      actor: null,
      ...properties,
    };
  }

  function tokenRequest(): ReceivedRequest {
    const found = idp.received.find((request) =>
      request.url.endsWith("/token"),
    );

    if (found === undefined) throw new Error("No token request arrived");

    return found;
  }

  function formOf(request: ReceivedRequest): string[][] {
    const form = new URLSearchParams(request.body);
    form.sort();
    return Array.from(form);
  }

  describe("content", () => {
    it.each([
      ["/json", "content", { id: 1, name: "Rex" }],
      ["/json", "response", { id: 1, name: "Rex" }],
      ["/json", "raw", "eyJpZCI6MSwibmFtZSI6IlJleCJ9"],
      ["/text", "content", "hello"],
      ["/text", "raw", "aGVsbG8="],
      ["/latin1", "content", "café"],
      ["/binary", "content", "AAEC/w=="],
      ["/empty", "content", null],
      ["/empty", "raw", null],
    ] as const)(
      "the_body_of_%s_in_the_%s_output_mode_is_decoded_as_the_contract_says",
      async (path, output, expected) => {
        const request = httpOf(path, null, output);

        const outcome = await gateway.perform(request, contextOf());

        expect(outcome).toMatchObject({ kind: "responded", content: expected });
      },
    );

    it("a_response_answers_its_status_and_headers", async () => {
      const request = httpOf("/json");

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        statusCode: 200,
        headers: { "content-type": "application/json" },
        authorization: null,
      });
    });

    it("a_status_outside_two_hundreds_is_answered_as_a_response", async () => {
      const request = httpOf("/missing");

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        statusCode: 404,
        content: { error: "no pet" },
      });
    });

    it.each([
      ["application/problem+json", { a: 1 }],
      ["application/xml", '{"a":1}'],
      ["image/png", "eyJhIjoxfQ=="],
      ["not a media type", { a: 1 }],
    ] as const)(
      "a_body_typed_%s_is_decoded_by_its_media_type",
      async (type, expected) => {
        const path = `/typed?as=${encodeURIComponent(type)}`;
        const request = httpOf(path);

        const outcome = await gateway.perform(request, contextOf());

        expect(outcome).toMatchObject({ kind: "responded", content: expected });
      },
    );

    it("every_cookie_the_response_sets_is_answered", async () => {
      const request = httpOf("/cookies");

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        headers: { "set-cookie": "a=1; Path=/, b=2; Path=/" },
      });
    });

    it("a_redirect_is_answered_and_not_followed", async () => {
      const request = httpOf("/moved");

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        statusCode: 302,
        headers: { location: "/json" },
      });
      expect(stub.received.map((received) => received.url)).toEqual(["/moved"]);
    });
  });

  describe("the request", () => {
    it("the_method_headers_and_json_body_are_sent_as_described", async () => {
      const request: HttpRequest = {
        kind: "http",
        method: "POST",
        endpoint: { uri: `${origin}/pets?tag=dog`, authentication: null },
        headers: { "x-trace": "abc" },
        body: { name: "Rex" },
        output: "content",
        revealAuthorization: false,
      };

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        content: {
          method: "POST",
          url: "/pets?tag=dog",
          headers: { "x-trace": "abc", "content-type": "application/json" },
          body: '{"name":"Rex"}',
        },
      });
    });

    it("the_request_as_sent_is_answered_without_its_credentials", async () => {
      const request: HttpRequest = {
        kind: "http",
        method: "POST",
        endpoint: {
          uri: `${origin}/pets?tag=dog`,
          authentication: { kind: "bearer", token: TOKEN },
        },
        headers: {
          "X-Trace": "abc",
          Authorization: "Basic replaced",
          "Proxy-Authorization": "Basic proxy",
        },
        body: { name: "Rex" },
        output: "response",
        revealAuthorization: true,
      };

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toEqual(
        expect.objectContaining({
          kind: "responded",
          request: {
            method: "POST",
            uri: `${origin}/pets?tag=dog`,
            headers: {
              "x-trace": "abc",
              "content-type": "application/json",
              "idempotency-key": "run-1/do/0/charge",
            },
          },
          authorization: { scheme: "Bearer", parameter: TOKEN },
        }),
      );
    });

    it("a_text_body_is_sent_as_it_is_with_its_declared_type", async () => {
      const request: HttpRequest = {
        kind: "http",
        method: "PUT",
        endpoint: { uri: `${origin}/notes`, authentication: null },
        headers: { "Content-Type": "text/plain" },
        body: "hello",
        output: "content",
        revealAuthorization: false,
      };

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        content: { headers: { "content-type": "text/plain" }, body: "hello" },
      });
    });

    it("the_step_s_idempotency_key_travels_as_the_idempotency_key_header", async () => {
      const request = httpOf("/echo");

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        content: { headers: { "idempotency-key": "run-1/do/0/charge" } },
      });
    });

    it("an_idempotency_key_the_author_declared_is_kept", async () => {
      const request: HttpRequest = {
        ...httpOf("/echo"),
        headers: { "Idempotency-Key": "author-key" },
      };

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        content: { headers: { "idempotency-key": "author-key" } },
      });
    });

    it("a_header_name_http_cannot_carry_is_misconfigured", async () => {
      const request: HttpRequest = {
        ...httpOf("/echo"),
        headers: { "bad header": "x" },
      };

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail:
          "The request cannot be sent: its URI, method, headers or body are not valid",
      });
    });
  });

  describe("failures", () => {
    it("a_call_still_unanswered_at_its_deadline_expires", async () => {
      const request = httpOf("/hang");

      const outcome = await gateway.perform(request, contextOf({}, 200));

      expect(outcome).toEqual({ kind: "expired" });
    });

    it.each([
      ["a_scheme_other_than_http", "ftp://127.0.0.1/pets"],
      ["a_malformed", "http://[::1/pets"],
    ])("%s_uri_is_misconfigured", async (_case, uri) => {
      const request: HttpRequest = {
        ...httpOf("/json"),
        endpoint: { uri, authentication: null },
      };

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail:
          "The request cannot be sent: its URI, method, headers or body are not valid",
      });
    });

    it("a_port_nobody_listens_on_is_unreachable", async () => {
      const port = await closedPort();
      const request: HttpRequest = {
        ...httpOf("/json"),
        endpoint: {
          uri: `http://127.0.0.1:${String(port)}/json`,
          authentication: null,
        },
      };

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "unreachable",
        detail: "The service refused the connection",
      });
    });

    it.each(["127.0.0.1", "localhost"])(
      "a_private_destination_%s_is_refused_before_any_connection",
      async (host) => {
        const guarded = new AddressPolicy([]);
        const guardedGateway = httpGatewayOf(guarded, resilience);
        const request: HttpRequest = {
          ...httpOf("/json"),
          endpoint: {
            uri: `http://${host}:${String(stub.port)}/json`,
            authentication: null,
          },
        };

        const outcome = await guardedGateway.perform(request, contextOf());

        expect(outcome).toEqual({
          kind: "unreachable",
          detail: REFUSED_ADDRESS,
        });
        expect(stub.received).toHaveLength(0);
        await guarded.onApplicationShutdown();
      },
    );

    it("a_response_larger_than_its_bound_is_unreachable", async () => {
      const request = httpOf("/large");

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toEqual({ kind: "unreachable", detail: OVERSIZED });
    });

    it("a_compressed_response_larger_than_its_bound_once_decoded_is_unreachable", async () => {
      const request = httpOf("/bomb");

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toEqual({ kind: "unreachable", detail: OVERSIZED });
    });
  });

  describe("authentication", () => {
    it("basic_authentication_is_sent_and_revealed_when_asked", async () => {
      const request = httpOf("/basic", {
        kind: "basic",
        username: "ada",
        password: "lovelace",
      });

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        statusCode: 200,
        authorization: {
          scheme: "Basic",
          parameter: Buffer.from("ada:lovelace").toString("base64"),
        },
      });
    });

    it("the_authorization_is_not_revealed_unless_the_task_reads_it", async () => {
      const request: HttpRequest = {
        ...httpOf("/basic", {
          kind: "basic",
          username: "ada",
          password: "lovelace",
        }),
        revealAuthorization: false,
      };

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        statusCode: 200,
        authorization: null,
      });
    });

    it("digest_authentication_the_profile_refuses_throws_before_any_request", async () => {
      const request = httpOf("/json", {
        kind: "digest",
        username: "Mufasa",
        password: "Circle of Life",
      });

      const sent = gateway.perform(request, contextOf());

      await expect(sent).rejects.toThrow(
        "The host does not perform 'authentication.digest'",
      );
      expect(stub.received).toHaveLength(0);
    });

    it("bearer_authentication_is_sent_as_its_token", async () => {
      const request = httpOf("/protected", { kind: "bearer", token: TOKEN });

      const outcome = await gateway.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        statusCode: 200,
        authorization: { scheme: "Bearer", parameter: TOKEN },
      });
    });

    describe("oauth2", () => {
      it("client_credentials_posts_the_client_scopes_and_audiences_in_a_form", async () => {
        const authentication = oauth2Of({
          scopes: ["api", "read"],
          audiences: ["runtime", "billing"],
        });
        const request = httpOf("/protected", authentication);

        const outcome = await gateway.perform(request, contextOf());

        expect(outcome).toMatchObject({
          kind: "responded",
          statusCode: 200,
          authorization: { scheme: "Bearer", parameter: TOKEN },
        });
        const token = tokenRequest();
        expect(token.url).toBe("/oauth2/token");
        expect(token.headers["content-type"]).toMatch(
          /^application\/x-www-form-urlencoded/,
        );
        expect(formOf(token)).toEqual([
          ["audience", "runtime"],
          ["audience", "billing"],
          ["client_id", "workflow-runtime"],
          ["client_secret", "s3cret"],
          ["grant_type", "client_credentials"],
          ["scope", "api read"],
        ]);
      });

      it("client_secret_basic_sends_the_client_in_the_authorization_header", async () => {
        const authentication = oauth2Of({
          client: {
            id: "workflow runtime",
            secret: "s3cret",
            assertion: null,
            authentication: "client_secret_basic",
          },
        });
        const request = httpOf("/protected", authentication);

        await gateway.perform(request, contextOf());

        const token = tokenRequest();
        expect(token.headers.authorization).toBe(
          `Basic ${Buffer.from("workflow+runtime:s3cret").toString("base64")}`,
        );
        expect(formOf(token)).toEqual([["grant_type", "client_credentials"]]);
      });

      it("the_json_encoding_sends_the_token_request_as_json", async () => {
        const authentication = oauth2Of({
          encoding: "application/json",
          scopes: ["api"],
          audiences: ["runtime"],
        });
        const request = httpOf("/protected", authentication);

        await gateway.perform(request, contextOf());

        const token = tokenRequest();
        expect(token.headers["content-type"]).toBe("application/json");
        expect(JSON.parse(token.body)).toEqual({
          grant_type: "client_credentials",
          scope: "api",
          audience: "runtime",
          client_id: "workflow-runtime",
          client_secret: "s3cret",
        });
      });

      it("the_token_exchange_grant_sends_the_subject_and_actor_tokens", async () => {
        const authentication = oauth2Of({
          grant: "urn:ietf:params:oauth:grant-type:token-exchange",
          subject: {
            token: "subject-token",
            type: "urn:ietf:params:oauth:token-type:access_token",
          },
          actor: {
            token: "actor-token",
            type: "urn:ietf:params:oauth:token-type:jwt",
          },
          audiences: ["billing"],
          client: {
            id: "workflow-runtime",
            secret: null,
            assertion: null,
            authentication: "none",
          },
        });
        const request = httpOf("/protected", authentication);

        await gateway.perform(request, contextOf());

        expect(formOf(tokenRequest())).toEqual([
          ["actor_token", "actor-token"],
          ["actor_token_type", "urn:ietf:params:oauth:token-type:jwt"],
          ["audience", "billing"],
          ["client_id", "workflow-runtime"],
          ["grant_type", "urn:ietf:params:oauth:grant-type:token-exchange"],
          ["subject_token", "subject-token"],
          [
            "subject_token_type",
            "urn:ietf:params:oauth:token-type:access_token",
          ],
        ]);
      });

      it("client_secret_jwt_signs_an_assertion_with_the_client_secret", async () => {
        const authentication = oauth2Of({
          client: {
            id: "workflow-runtime",
            secret: "s3cret",
            assertion: null,
            authentication: "client_secret_jwt",
          },
        });
        const request = httpOf("/protected", authentication);

        const outcome = await gateway.perform(request, contextOf());

        expect(outcome).toMatchObject({ kind: "responded", statusCode: 200 });
        const form = new URLSearchParams(tokenRequest().body);
        expect(form.get("client_assertion_type")).toBe(
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        );
        const [header = "", claims = "", signature] = (
          form.get("client_assertion") ?? ""
        ).split(".");
        const expected = createHmac("sha256", "s3cret")
          .update(`${header}.${claims}`)
          .digest("base64url");
        expect(signature).toBe(expected);
        expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual(
          { alg: "HS256" },
        );
        expect(
          JSON.parse(Buffer.from(claims, "base64url").toString()),
        ).toMatchObject({
          iss: "workflow-runtime",
          sub: "workflow-runtime",
          aud: authority,
        });
      });

      it("private_key_jwt_sends_the_given_assertion", async () => {
        const authentication = oauth2Of({
          client: {
            id: "workflow-runtime",
            secret: null,
            assertion: "signed.assertion.jwt",
            authentication: "private_key_jwt",
          },
        });
        const request = httpOf("/protected", authentication);

        await gateway.perform(request, contextOf());

        expect(formOf(tokenRequest())).toEqual([
          ["client_assertion", "signed.assertion.jwt"],
          [
            "client_assertion_type",
            "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
          ],
          ["grant_type", "client_credentials"],
        ]);
      });

      it("private_key_jwt_without_an_assertion_is_unauthenticated", async () => {
        const authentication = oauth2Of({
          client: {
            id: "workflow-runtime",
            secret: null,
            assertion: null,
            authentication: "private_key_jwt",
          },
        });
        const request = httpOf("/protected", authentication);

        const outcome = await gateway.perform(request, contextOf());

        expect(outcome).toEqual({
          kind: "unauthenticated",
          detail: "private_key_jwt needs the client assertion",
        });
      });

      it("a_jwt_token_whose_iss_claim_is_an_accepted_issuer_is_used", async () => {
        const authentication = oauth2Of({
          authority: `${authority}/issuing`,
          issuers: [ISSUER],
        });
        const request = httpOf("/echo", authentication);

        const outcome = await gateway.perform(request, contextOf());

        expect(outcome).toMatchObject({
          kind: "responded",
          authorization: { scheme: "Bearer", parameter: JWT_TOKEN },
        });
      });

      it("a_jwt_token_whose_iss_claim_is_another_issuer_is_unauthenticated", async () => {
        const authentication = oauth2Of({
          authority: `${authority}/issuing`,
          issuers: ["https://other.test"],
        });
        const request = httpOf("/echo", authentication);

        const outcome = await gateway.perform(request, contextOf());

        expect(outcome).toEqual({
          kind: "unauthenticated",
          detail: "The token was not issued by one of the accepted issuers",
        });
        expect(idp.received.map((received) => received.url)).toEqual([
          "/issuing/oauth2/token",
        ]);
        expect(stub.received).toHaveLength(0);
      });

      it("an_opaque_token_is_not_checked_against_the_issuers", async () => {
        const authentication = oauth2Of({ issuers: ["https://other.test"] });
        const request = httpOf("/protected", authentication);

        const outcome = await gateway.perform(request, contextOf());

        expect(outcome).toMatchObject({
          kind: "responded",
          statusCode: 200,
          authorization: { scheme: "Bearer", parameter: TOKEN },
        });
      });

      it("a_token_endpoint_that_refuses_is_unauthenticated", async () => {
        const authentication = oauth2Of({ authority: `${authority}/refusing` });
        const request = httpOf("/protected", authentication);

        const outcome = await gateway.perform(request, contextOf());

        expect(outcome).toEqual({
          kind: "unauthenticated",
          detail: "The authorization server refused to issue a token",
        });
      });

      it("a_token_endpoint_at_a_refused_address_is_unreachable", async () => {
        const guarded = httpGatewayOf(policy, resilience);
        const authentication = oauth2Of({
          authority: `https://localhost:${String(idp.port)}`,
        });
        const request = httpOf("/protected", authentication);

        const outcome = await guarded.perform(request, contextOf());

        expect(outcome).toEqual({
          kind: "unreachable",
          detail: REFUSED_ADDRESS,
        });
        expect(idp.received).toHaveLength(0);
        expect(stub.received).toHaveLength(0);
      });

      it("a_token_endpoint_over_plain_http_is_unauthenticated", async () => {
        const authentication = oauth2Of({ authority: origin });
        const request = httpOf("/protected", authentication);

        const outcome = await gateway.perform(request, contextOf());

        expect(outcome).toEqual({
          kind: "unauthenticated",
          detail:
            "The authorization server is not reached over HTTPS, which OAuth 2.0 requires",
        });
        expect(stub.received).toHaveLength(0);
      });
    });

    describe("oidc", () => {
      it.each([["/realms/x"], ["/realms/x/.well-known/openid-configuration"]])(
        "the_token_endpoint_is_discovered_from_the_authority_%s",
        async (path) => {
          const authentication: Authentication = {
            ...(oauth2Of() as OAuth2Properties),
            kind: "oidc",
            authority: `${idp.origin}${path}`,
            endpoints: null,
          };
          const request = httpOf("/protected", authentication);

          const outcome = await gateway.perform(request, contextOf());

          expect(outcome).toMatchObject({
            kind: "responded",
            statusCode: 200,
            authorization: { scheme: "Bearer", parameter: TOKEN },
          });
          expect(idp.received.map((received) => received.url)).toEqual([
            "/realms/x/.well-known/openid-configuration",
            "/realms/x/token",
          ]);
          expect(stub.received.map((received) => received.url)).toEqual([
            "/protected",
          ]);
        },
      );

      it("a_provider_whose_discovered_issuer_is_accepted_issues_the_token", async () => {
        const authentication: Authentication = {
          ...(oauth2Of() as OAuth2Properties),
          kind: "oidc",
          authority: `${authority}/realms/x`,
          endpoints: null,
          issuers: [`${authority}/realms/x`],
        };
        const request = httpOf("/protected", authentication);

        const outcome = await gateway.perform(request, contextOf());

        expect(outcome).toMatchObject({ kind: "responded", statusCode: 200 });
      });

      it("the_token_of_an_accepted_provider_is_not_checked_against_the_issuers", async () => {
        const authentication: Authentication = {
          ...(oauth2Of() as OAuth2Properties),
          kind: "oidc",
          authority: `${authority}/realms/jwt`,
          endpoints: null,
          issuers: [`${authority}/realms/jwt`],
        };
        const request = httpOf("/echo", authentication);

        const outcome = await gateway.perform(request, contextOf());

        expect(outcome).toMatchObject({
          kind: "responded",
          statusCode: 200,
          authorization: { scheme: "Bearer", parameter: JWT_TOKEN },
        });
      });

      it("a_provider_whose_discovered_issuer_is_not_accepted_is_unauthenticated_before_the_token_request", async () => {
        const authentication: Authentication = {
          ...(oauth2Of() as OAuth2Properties),
          kind: "oidc",
          authority: `${authority}/realms/x`,
          endpoints: null,
          issuers: ["https://other.test"],
        };
        const request = httpOf("/protected", authentication);

        const outcome = await gateway.perform(request, contextOf());

        expect(outcome).toEqual({
          kind: "unauthenticated",
          detail: "The OpenID provider is not one of the accepted issuers",
        });
        expect(idp.received.map((received) => received.url)).toEqual([
          "/realms/x/.well-known/openid-configuration",
        ]);
      });

      it("a_discovery_without_a_token_endpoint_is_unauthenticated", async () => {
        const authentication: Authentication = {
          ...(oauth2Of() as OAuth2Properties),
          kind: "oidc",
          authority: `${authority}/realms/bare`,
          endpoints: null,
        };
        const request = httpOf("/protected", authentication);

        const outcome = await gateway.perform(request, contextOf());

        expect(outcome).toEqual({
          kind: "unauthenticated",
          detail: "The OpenID provider configuration names no token endpoint",
        });
      });

      it("a_discovery_at_a_refused_address_is_unreachable", async () => {
        const guarded = httpGatewayOf(policy, resilience);
        const authentication: Authentication = {
          ...(oauth2Of() as OAuth2Properties),
          kind: "oidc",
          authority: `https://localhost:${String(idp.port)}/realms/x`,
          endpoints: null,
        };
        const request = httpOf("/protected", authentication);

        const outcome = await guarded.perform(request, contextOf());

        expect(outcome).toEqual({
          kind: "unreachable",
          detail: REFUSED_ADDRESS,
        });
      });
    });

    describe("a named secret", () => {
      it("basic_credentials_come_from_the_secret_s_value", async () => {
        const secrets = {
          petstore: { username: "ada", password: "lovelace" },
        };
        const request = httpOf("/basic", {
          kind: "secret",
          scheme: "basic",
          secret: "petstore",
        });

        const outcome = await gateway.perform(request, contextOf(secrets));

        expect(outcome).toMatchObject({ kind: "responded", statusCode: 200 });
      });

      it("a_bearer_token_comes_from_the_secret_s_value", async () => {
        const secrets = { api: { token: TOKEN } };
        const request = httpOf("/protected", {
          kind: "secret",
          scheme: "bearer",
          secret: "api",
        });

        const outcome = await gateway.perform(request, contextOf(secrets));

        expect(outcome).toMatchObject({ kind: "responded", statusCode: 200 });
      });

      it("oauth2_properties_from_a_secret_take_the_reference_s_defaults", async () => {
        const secrets = {
          idp: {
            authority,
            grant: "client_credentials",
            client: { id: "workflow-runtime", secret: "s3cret" },
          },
        };
        const request = httpOf("/protected", {
          kind: "secret",
          scheme: "oauth2",
          secret: "idp",
        });

        const outcome = await gateway.perform(request, contextOf(secrets));

        expect(outcome).toMatchObject({ kind: "responded", statusCode: 200 });
        expect(tokenRequest().url).toBe("/oauth2/token");
        expect(formOf(tokenRequest())).toEqual([
          ["client_id", "workflow-runtime"],
          ["client_secret", "s3cret"],
          ["grant_type", "client_credentials"],
        ]);
      });

      it("oidc_properties_from_a_secret_are_discovered", async () => {
        const secrets = {
          idp: {
            authority: `${authority}/realms/x`,
            grant: "client_credentials",
            client: { id: "workflow-runtime", secret: "s3cret" },
          },
        };
        const request = httpOf("/protected", {
          kind: "secret",
          scheme: "oidc",
          secret: "idp",
        });

        const outcome = await gateway.perform(request, contextOf(secrets));

        expect(outcome).toMatchObject({ kind: "responded", statusCode: 200 });
      });

      it("a_missing_secret_is_forbidden", async () => {
        const request = httpOf("/protected", {
          kind: "secret",
          scheme: "bearer",
          secret: "vault",
        });

        const outcome = await gateway.perform(request, contextOf());

        expect(outcome).toEqual({
          kind: "forbidden",
          detail: "The secret is not among the secrets of this run",
        });
        expect(stub.received).toHaveLength(0);
      });

      it.each([
        ["a text", "ada:lovelace", "Basic must be an object."],
        ["a user only", { user: "ada" }, "Username is required."],
        ["a number", 42, "Basic must be an object."],
      ] as const)(
        "a_secret_holding_%s_is_misconfigured_for_basic_authentication",
        async (_holding, value, reason) => {
          const request = httpOf("/basic", {
            kind: "secret",
            scheme: "basic",
            secret: "petstore",
          });

          const outcome = await gateway.perform(
            request,
            contextOf({ petstore: value }),
          );

          expect(outcome).toEqual({
            kind: "misconfigured",
            detail: `The secret's basic policy is refused: ${reason}`,
          });
          expect(stub.received).toHaveLength(0);
        },
      );

      it("a_secret_without_the_oauth2_properties_is_misconfigured_before_any_request", async () => {
        const request = httpOf("/protected", {
          kind: "secret",
          scheme: "oauth2",
          secret: "idp",
        });

        const outcome = await gateway.perform(
          request,
          contextOf({ idp: { authority } }),
        );

        expect(outcome).toEqual({
          kind: "misconfigured",
          detail: "The secret's oauth2 policy is refused: Grant is required.",
        });
        expect(stub.received).toHaveLength(0);
      });

      it("a_secret_holding_a_grant_the_host_does_not_give_is_misconfigured_before_any_request", async () => {
        const request = httpOf("/protected", {
          kind: "secret",
          scheme: "oauth2",
          secret: "idp",
        });
        const held = {
          authority,
          grant: "authorization_code",
          client: { id: "workflow-runtime" },
        };

        const outcome = await gateway.perform(
          request,
          contextOf({ idp: held }),
        );

        expect(outcome).toEqual({
          kind: "misconfigured",
          detail:
            "The secret's oauth2 policy is refused: The host does not provide 'authorization_code'.",
        });
        expect(stub.received).toHaveLength(0);
        expect(idp.received).toHaveLength(0);
      });
    });
  });

  describe("openapi", () => {
    function openApiOf(
      document: string,
      operationId: string,
      parameters: OpenApiRequest["parameters"],
      authentication: Authentication | null = null,
    ): OpenApiRequest {
      return {
        kind: "openapi",
        document: {
          name: null,
          endpoint: { uri: `${origin}${document}`, authentication: null },
        },
        operationId,
        parameters,
        authentication,
        output: "content",
        revealAuthorization: false,
      };
    }

    it("a_swagger_operation_sends_its_query_parameters", async () => {
      const request = openApiOf("/v2/swagger.json", "findPetsByStatus", {
        status: ["available", "sold"],
      });

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        statusCode: 200,
        content: {
          method: "GET",
          url: "/v2/pet/findByStatus?status=available&status=sold",
        },
      });
    });

    it("a_swagger_operation_fills_its_path_and_header_parameters", async () => {
      const request = openApiOf("/v2/swagger.json", "deletePet", {
        petId: 7,
        api_key: "k-1",
      });

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        content: {
          method: "DELETE",
          url: "/v2/pet/7",
          headers: { api_key: "k-1" },
        },
      });
    });

    it("a_swagger_body_parameter_is_sent_as_the_consumed_media", async () => {
      const request = openApiOf("/v2/swagger.json", "addPet", {
        body: { name: "Rex" },
      });

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        content: {
          method: "POST",
          url: "/v2/pet",
          headers: { "content-type": "application/json" },
          body: '{"name":"Rex"}',
        },
      });
    });

    it("a_swagger_form_parameter_is_sent_as_a_form", async () => {
      const request = openApiOf("/v2/swagger.json", "updatePetWithForm", {
        petId: 7,
        name: "Rex",
        status: "sold",
      });

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        content: {
          method: "POST",
          url: "/v2/pet/7",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: "name=Rex&status=sold",
        },
      });
    });

    it("an_openapi_3_operation_resolves_its_references_server_and_body", async () => {
      const request = openApiOf("/v3/openapi.json", "createOrder", {
        "X-Tenant": "acme",
        session: "abc",
        tags: ["a", "b"],
        body: { item: "pen", quantity: 2 },
      });

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        content: {
          method: "POST",
          url: "/api/orders?tags=a,b",
          headers: {
            "x-tenant": "acme",
            cookie: "session=abc",
            "content-type": "application/json",
            "idempotency-key": "run-1/do/0/charge",
          },
          body: '{"item":"pen","quantity":2}',
        },
      });
    });

    it("the_request_an_operation_sent_is_answered_without_its_credentials", async () => {
      const request = openApiOf(
        "/v3/openapi.json",
        "createOrder",
        {
          "X-Tenant": "acme",
          session: "abc",
          tags: ["a", "b"],
          body: { item: "pen", quantity: 2 },
        },
        { kind: "bearer", token: TOKEN },
      );

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toEqual(
        expect.objectContaining({
          kind: "responded",
          request: {
            method: "POST",
            uri: `${origin}/api/orders?tags=a,b`,
            headers: {
              "x-tenant": "acme",
              cookie: "session=abc",
              "content-type": "application/json",
              "idempotency-key": "run-1/do/0/charge",
            },
          },
        }),
      );
    });

    it("an_openapi_3_operation_that_declares_a_parameter_named_body_is_misconfigured", async () => {
      const request = openApiOf("/v3/openapi.json", "putNote", {
        body: "remember",
      });

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail:
          'The operation "putNote" declares a parameter named "body", the name of its request body',
      });
      expect(stub.received).toHaveLength(1);
    });

    it("an_openapi_document_in_yaml_is_read", async () => {
      const request = openApiOf("/v3/openapi.yaml", "listPets", {});

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        content: { method: "GET", url: "/yaml/pets" },
      });
    });

    it("the_operation_s_authentication_is_applied_to_the_call", async () => {
      const request = openApiOf(
        "/v2/swagger.json",
        "getPetById",
        { petId: 1 },
        { kind: "bearer", token: TOKEN },
      );

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        content: {
          url: "/v2/pet/1",
          headers: { authorization: `Bearer ${TOKEN}` },
        },
      });
    });

    it("the_document_s_own_authentication_is_applied_to_its_reading", async () => {
      const request: OpenApiRequest = {
        ...openApiOf("/v2/swagger.json", "getPetById", { petId: 1 }),
        document: {
          name: null,
          endpoint: {
            uri: `${origin}/private/swagger.json`,
            authentication: {
              kind: "basic",
              username: "ada",
              password: "lovelace",
            },
          },
        },
      };

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toMatchObject({
        kind: "responded",
        statusCode: 200,
        content: { url: "/v2/pet/1" },
      });
      expect(stub.received[0]?.headers.authorization).toBe(BASIC);
      expect(stub.received[1]?.headers.authorization).toBeUndefined();
    });

    it("an_operation_the_document_lacks_is_misconfigured", async () => {
      const request = openApiOf("/v2/swagger.json", "adoptPet", {});

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail: 'The OpenAPI document has no operation "adoptPet"',
      });
    });

    it("a_missing_required_parameter_is_misconfigured", async () => {
      const request = openApiOf("/v2/swagger.json", "getPetById", {});

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail:
          'The operation "getPetById" cannot be called: Required parameter petId is not provided',
      });
    });

    it("a_missing_required_body_is_misconfigured", async () => {
      const request = openApiOf("/v3/openapi.json", "createOrder", {
        "X-Tenant": "acme",
      });

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail: 'The operation "createOrder" requires a request body',
      });
    });

    it("a_parameter_the_operation_does_not_declare_is_misconfigured", async () => {
      const request = openApiOf("/v2/swagger.json", "getPetById", {
        petId: 1,
        color: "red",
      });

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail: 'The operation "getPetById" has no parameter "color"',
      });
      expect(stub.received).toHaveLength(1);
    });

    it("a_document_that_cannot_be_parsed_is_misconfigured", async () => {
      const request = openApiOf("/v3/broken.json", "listPets", {});

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail: "The OpenAPI document cannot be parsed",
      });
    });

    it("a_document_the_server_does_not_have_is_rejected_with_its_status", async () => {
      const request = openApiOf("/missing", "listPets", {});

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "rejected",
        statusCode: 404,
        detail: "The server answered the resource with status 404",
      });
    });

    it("a_multipart_request_body_is_misconfigured_before_the_call", async () => {
      const request = openApiOf("/v3/openapi.json", "uploadPhoto", {
        body: { caption: "Rex" },
      });

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail: "The host does not send multipart/form-data request bodies",
      });
      expect(stub.received).toHaveLength(1);
    });

    it("a_document_at_a_refused_address_is_unreachable", async () => {
      const request: OpenApiRequest = {
        ...openApiOf("/v2/swagger.json", "getPetById", { petId: 1 }),
        document: {
          name: null,
          endpoint: {
            uri: `http://localhost:${String(stub.port)}/v2/swagger.json`,
            authentication: null,
          },
        },
      };

      const outcome = await openApi.perform(request, contextOf());

      expect(outcome).toEqual({ kind: "unreachable", detail: REFUSED_ADDRESS });
    });
  });

  describe("a fetch a protocol client makes", () => {
    const anonymous = { kind: "anonymous" } as const;

    it("a_redirect_is_not_followed_unless_the_request_asks", async () => {
      const fetch = gateway.fetchFor(anonymous, new AbortController().signal);

      const response = await fetch(`${origin}/moved`);

      expect(response.status).toBe(302);
      expect(stub.received.map((received) => received.url)).toEqual(["/moved"]);
    });

    it("a_redirect_the_request_asks_to_follow_is_followed", async () => {
      const fetch = gateway.fetchFor(anonymous, new AbortController().signal);

      const response = await fetch(`${origin}/moved`, { redirect: "follow" });

      expect(response.status).toBe(200);
      expect(stub.received.map((received) => received.url)).toEqual([
        "/moved",
        "/json",
      ]);
    });

    it("a_followed_redirect_to_a_refused_address_is_unreachable", async () => {
      const fetch = gateway.fetchFor(anonymous, new AbortController().signal);
      const fetched = fetch(`${origin}/escape`, { redirect: "follow" });

      const failure = await fetched.then(
        () => null,
        (error: unknown) => new TransportFailures().classified(error),
      );

      expect(failure).toEqual({ kind: "unreachable", detail: REFUSED_ADDRESS });
    });
  });

  describe("a resource", () => {
    function resourceOf(
      path: string,
      authentication: Authentication | null = null,
    ): ResourceRequest {
      return {
        kind: "resource",
        resource: {
          name: "script",
          endpoint: { uri: `${origin}${path}`, authentication },
        },
      };
    }

    it("a_resource_answers_its_document", async () => {
      const request = resourceOf("/script.js");

      const outcome = await resources.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "fetched",
        document: "console.log(1);",
      });
    });

    it("a_resource_is_read_with_its_authentication", async () => {
      const request = resourceOf("/basic", {
        kind: "basic",
        username: "ada",
        password: "lovelace",
      });

      const outcome = await resources.perform(request, contextOf());

      expect(outcome).toMatchObject({ kind: "fetched" });
    });

    it("a_resource_that_refuses_the_credentials_is_rejected_with_its_status", async () => {
      const request = resourceOf("/basic", {
        kind: "basic",
        username: "ada",
        password: "wrong",
      });

      const outcome = await resources.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "rejected",
        statusCode: 401,
        detail: "The server answered the resource with status 401",
      });
    });

    it("a_resource_the_server_does_not_have_is_rejected_with_its_status", async () => {
      const request = resourceOf("/missing");

      const outcome = await resources.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "rejected",
        statusCode: 404,
        detail: "The server answered the resource with status 404",
      });
    });

    it("a_resource_that_redirects_is_rejected_and_not_followed", async () => {
      const request = resourceOf("/moved");

      const outcome = await resources.perform(request, contextOf());

      expect(outcome).toEqual({
        kind: "rejected",
        statusCode: 302,
        detail: "The server answered the resource with status 302",
      });
      expect(stub.received.map((received) => received.url)).toEqual(["/moved"]);
    });

    it("a_resource_at_a_refused_address_is_unreachable", async () => {
      const request: ResourceRequest = {
        kind: "resource",
        resource: {
          name: null,
          endpoint: {
            uri: `http://localhost:${String(stub.port)}/script.js`,
            authentication: null,
          },
        },
      };

      const outcome = await resources.perform(request, contextOf());

      expect(outcome).toEqual({ kind: "unreachable", detail: REFUSED_ADDRESS });
    });

    it("a_resource_still_unanswered_at_its_deadline_expires", async () => {
      const request = resourceOf("/hang");

      const outcome = await resources.perform(request, contextOf({}, 200));

      expect(outcome).toEqual({ kind: "expired" });
    });
  });
});

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function swaggerDocument(port: number): unknown {
  return {
    swagger: "2.0",
    host: `127.0.0.1:${String(port)}`,
    basePath: "/v2",
    schemes: ["http"],
    consumes: ["application/json"],
    paths: {
      "/pet": {
        post: {
          operationId: "addPet",
          parameters: [
            {
              in: "body",
              name: "body",
              required: true,
              schema: { $ref: "#/definitions/Pet" },
            },
          ],
        },
      },
      "/pet/findByStatus": {
        get: {
          operationId: "findPetsByStatus",
          parameters: [
            {
              name: "status",
              in: "query",
              required: true,
              type: "array",
              items: { type: "string" },
              collectionFormat: "multi",
            },
          ],
        },
      },
      "/pet/{petId}": {
        parameters: [
          { name: "petId", in: "path", required: true, type: "integer" },
        ],
        get: { operationId: "getPetById" },
        post: {
          operationId: "updatePetWithForm",
          consumes: ["application/x-www-form-urlencoded"],
          parameters: [
            { name: "name", in: "formData", type: "string" },
            { name: "status", in: "formData", type: "string" },
          ],
        },
        delete: {
          operationId: "deletePet",
          parameters: [{ name: "api_key", in: "header", type: "string" }],
        },
      },
    },
    definitions: {
      Pet: { type: "object", properties: { name: { type: "string" } } },
    },
  };
}

function openApiDocument(port: number): unknown {
  return {
    openapi: "3.1.0",
    info: { title: "Orders", version: "1.0.0" },
    servers: [
      {
        url: `{scheme}://127.0.0.1:${String(port)}/api`,
        variables: { scheme: { default: "http" } },
      },
    ],
    paths: {
      "/orders": {
        post: {
          operationId: "createOrder",
          parameters: [
            { $ref: "#/components/parameters/Tenant" },
            { name: "session", in: "cookie" },
            {
              name: "tags",
              in: "query",
              explode: false,
              schema: { type: "array" },
            },
          ],
          requestBody: { $ref: "#/components/requestBodies/Order" },
        },
      },
      "/notes": {
        put: {
          operationId: "putNote",
          parameters: [{ name: "body", in: "query" }],
          requestBody: { content: { "text/plain": {} } },
        },
      },
      "/photos": {
        post: {
          operationId: "uploadPhoto",
          requestBody: {
            content: { "multipart/form-data": { schema: { type: "object" } } },
          },
        },
      },
    },
    components: {
      parameters: {
        Tenant: { name: "X-Tenant", in: "header", required: true },
      },
      requestBodies: {
        Order: {
          required: true,
          content: {
            "application/json": { schema: { type: "object" } },
          },
        },
      },
    },
  };
}

const YAML_DOCUMENT = `openapi: 3.0.3
info:
  title: Pets
  version: 1.0.0
servers:
  - url: /yaml
paths:
  /pets:
    get:
      operationId: listPets
`;
