import type { LookupAddress } from "node:dns";
import {
  credentials,
  loadPackageDefinition,
  Server,
  ServerCredentials,
  type ServerUnaryCall,
  type ServerWritableStream,
  type sendUnaryData,
  type ServiceClientConstructor,
  status,
} from "@grpc/grpc-js";
import { fromJSON } from "@grpc/proto-loader";
import type { INestApplicationContext } from "@nestjs/common";
import { ResilienceService } from "@nestjs/resilience";
import { Test } from "@nestjs/testing";
import type { Authentication, GrpcRequest, JsonObject } from "interpreter";
import { common, parse } from "protobufjs";
import { ResilienceModule } from "@nestjs/resilience";
import {
  resiliencePresets,
  responseSizeLimit,
} from "../../../../src/frameworks/di/host.presets.js";
import { GrpcClient } from "../../../../src/frameworks/grpc/grpc.client.js";
import { ProtoSchema } from "../../../../src/frameworks/grpc/proto-schema.js";
import { AddressPolicy } from "../../../../src/frameworks/http-client/address-policy.js";
import type { HttpAuthentication } from "../../../../src/frameworks/http-client/http-authentication.js";
import type { HttpClient } from "../../../../src/frameworks/http-client/http.client.js";
import { TransportFailures } from "../../../../src/frameworks/http-client/transport-failures.js";
import type { CallContext } from "../../../../src/frameworks/interpreter/interfaces.js";
import {
  closedPort,
  startStubServer,
  type StubServer,
} from "../../../support/stub-server.js";
import {
  authenticationOf,
  callContextOf,
  fetchClientOf,
  httpClientOf,
} from "../../../support/outbound.js";

const TOKEN = "token-1";
const PUBLIC_ADDRESS = "8.8.8.8";
const BASIC = `Basic ${Buffer.from("ada:lovelace").toString("base64")}`;
const REFUSED_ADDRESS =
  "The address is private, loopback or link-local and not allow-listed";
const PROTO = `
syntax = "proto3";

package GreeterApi;

import "google/protobuf/timestamp.proto";

service Greeter {
  rpc SayHello (HelloRequest) returns (HelloReply);
  rpc SayHellos (HelloRequest) returns (stream HelloReply);
  rpc Collect (stream HelloRequest) returns (HelloReply);
}

message HelloRequest {
  string name = 1;
  int32 times = 2;
  Origin origin = 3;
  string user_id = 4;
  repeated Origin stops = 5;
}

message Origin {
  string city = 1;
}

message HelloReply {
  string message = 1;
  int64 count = 2;
  google.protobuf.Timestamp at = 3;
  double ratio = 6;
  oneof mood {
    string feeling = 4;
    int32 level = 5;
  }
}
`;

interface HelloRequest {
  readonly name: string;
  readonly times: number;
  readonly user_id: string;
  readonly stops: readonly { readonly city: string }[];
}

class PublicAddresses extends AddressPolicy {
  override resolve(): Promise<readonly LookupAddress[]> {
    return Promise.resolve([{ address: PUBLIC_ADDRESS, family: 4 }]);
  }
}

interface Received {
  readonly method: string;
  readonly authorization: string | null;
  readonly idempotencyKey: string | null;
}

describe("a call the gRPC client performs for a run", () => {
  let context: INestApplicationContext;
  let resilience: ResilienceService;
  let policy: AddressPolicy;
  let http: HttpClient;
  let authentication: HttpAuthentication;
  let client: GrpcClient;
  let protos: StubServer;
  let server: Server;
  let port = 0;
  const received: Received[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule.forRoot({ presets: resiliencePresets })],
    }).compile();
    context = await moduleRef.init();
    resilience = context.get(ResilienceService);
    policy = new AddressPolicy(["127.0.0.1"]);
    http = httpClientOf(policy, resilience);
    authentication = authenticationOf(fetchClientOf(policy.dispatcher));
    client = new GrpcClient(
      policy,
      http,
      authentication,
      new ProtoSchema(),
      new TransportFailures(),
      responseSizeLimit,
      resilience,
    );
    protos = await startStubServer((request, response) => {
      if (
        request.url === "/private.proto" &&
        request.headers.authorization !== BASIC
      ) {
        response.writeHead(401).end();
        return;
      }

      const texts = new Map([
        ["/greet.proto", PROTO],
        ["/private.proto", PROTO],
        ["/broken.proto", "service {"],
        ["/importing.proto", 'syntax = "proto3"; import "other.proto";'],
      ]);
      const text = texts.get(request.url);

      if (text === undefined) {
        response.writeHead(404).end();
        return;
      }

      response.writeHead(200, { "content-type": "text/plain" });
      response.end(text);
    });
    server = new Server();
    server.addService(greeterService(), {
      SayHello: sayHello,
      SayHellos: sayHellos,
      Collect: () => undefined,
    });
    port = await new Promise<number>((resolve, reject) => {
      server.bindAsync(
        "127.0.0.1:0",
        ServerCredentials.createInsecure(),
        (error, bound) => {
          if (error !== null) {
            reject(error);
            return;
          }

          resolve(bound);
        },
      );
    });
  });

  afterAll(async () => {
    server.forceShutdown();
    client.onApplicationShutdown();
    await protos.close();
    await policy.onApplicationShutdown();
    await context.close();
  });

  beforeEach(() => {
    received.length = 0;
    protos.received.length = 0;
  });

  function record(
    method: string,
    call:
      | ServerUnaryCall<HelloRequest, unknown>
      | ServerWritableStream<HelloRequest, unknown>,
  ): void {
    const [authorization = null] = call.metadata.get("authorization");
    const [idempotencyKey = null] = call.metadata.get("idempotency-key");
    received.push({
      method,
      authorization: authorization === null ? null : String(authorization),
      idempotencyKey: idempotencyKey === null ? null : String(idempotencyKey),
    });
  }

  function sayHello(
    call: ServerUnaryCall<HelloRequest, unknown>,
    callback: sendUnaryData<unknown>,
  ): void {
    record("SayHello", call);
    const name = call.request.name;
    const [authorization = null] = call.metadata.get("authorization");

    if (name === "hang") return;

    if (name === "echo") {
      const stops = call.request.stops.map((stop) => stop.city).join(",");
      callback(null, { message: `${call.request.user_id}:${stops}` });
      return;
    }

    if (name === "Infinity" || name === "NaN") {
      callback(null, { message: "Hello", ratio: Number(name) });
      return;
    }

    if (name === "moody") {
      callback(null, { message: "Hello", feeling: "cheerful" });
      return;
    }

    if (name === "huge") {
      callback(null, { message: "x".repeat(2 * 1024 * 1024) });
      return;
    }

    if (name === "nobody") {
      callback({ code: status.NOT_FOUND, details: "No such person" });
      return;
    }

    if (name === "guarded" && authorization !== `Bearer ${TOKEN}`) {
      callback({ code: status.UNAUTHENTICATED, details: "Who are you?" });
      return;
    }

    callback(null, {
      message: `Hello, ${name}`,
      count: "9007199254740993",
      at: { seconds: "1700000000", nanos: 0 },
    });
  }

  function sayHellos(call: ServerWritableStream<HelloRequest, unknown>): void {
    record("SayHellos", call);
    const request = call.request;

    if (request.name === "flood") {
      for (let index = 0; index < 3; index += 1)
        call.write({ message: "x".repeat(512 * 1024) });

      call.end();
      return;
    }

    for (let index = 1; index <= request.times; index += 1)
      call.write({ message: `Hello, ${request.name} #${String(index)}` });

    call.end();
  }

  function contextOf(
    secrets: JsonObject = {},
    remaining: number | null = null,
  ): CallContext {
    return callContextOf("run-1/do/0/greet", secrets, remaining);
  }

  function grpcOf(
    method: string,
    values: JsonObject,
    authentication: Authentication | null = null,
  ): GrpcRequest {
    return {
      kind: "grpc",
      proto: {
        name: null,
        endpoint: { uri: `${protos.origin}/greet.proto`, authentication: null },
      },
      method,
      arguments: values,
      service: { name: "GreeterApi.Greeter", host: "127.0.0.1", port },
      authentication,
    };
  }

  describe("methods", () => {
    it("a_unary_method_replies_with_its_message_in_json", async () => {
      const outcome = await client.call(
        grpcOf("SayHello", { name: "Ada" }),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "replied",
        message: {
          message: "Hello, Ada",
          count: "9007199254740993",
          at: { seconds: "1700000000", nanos: 0 },
          ratio: 0,
        },
      });
    });

    it("a_oneof_replies_with_its_member_and_no_field_of_its_own", async () => {
      const outcome = await client.call(
        grpcOf("SayHello", { name: "moody" }),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "replied",
        message: {
          message: "Hello",
          count: "0",
          at: null,
          ratio: 0,
          feeling: "cheerful",
        },
      });
    });

    it.each(["Infinity", "NaN"])(
      "a_double_of_%s_replies_as_the_mapping_s_string",
      async (name) => {
        const outcome = await client.call(
          grpcOf("SayHello", { name }),
          contextOf(),
        );

        expect(outcome).toEqual({
          kind: "replied",
          message: { message: "Hello", count: "0", at: null, ratio: name },
        });
      },
    );

    it("a_server_streaming_method_replies_with_its_messages_in_order", async () => {
      const outcome = await client.call(
        grpcOf("SayHellos", { name: "Ada", times: 3 }),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "replied",
        message: [
          { message: "Hello, Ada #1", count: "0", at: null, ratio: 0 },
          { message: "Hello, Ada #2", count: "0", at: null, ratio: 0 },
          { message: "Hello, Ada #3", count: "0", at: null, ratio: 0 },
        ],
      });
    });

    it.each([
      ["proto", { name: "echo", user_id: "u-1", stops: [{ city: "Kyiv" }] }],
      ["json", { name: "echo", userId: "u-1", stops: [{ city: "Kyiv" }] }],
    ])(
      "arguments_named_as_the_%s_names_the_fields_are_sent",
      async (_names, values) => {
        const outcome = await client.call(
          grpcOf("SayHello", values),
          contextOf(),
        );

        expect(outcome).toMatchObject({
          kind: "replied",
          message: { message: "u-1:Kyiv" },
        });
      },
    );

    it("the_step_s_idempotency_key_travels_as_metadata", async () => {
      await client.call(grpcOf("SayHello", { name: "Ada" }), contextOf());

      expect(received).toEqual([
        {
          method: "SayHello",
          authorization: null,
          idempotencyKey: "run-1/do/0/greet",
        },
      ]);
    });

    it("a_status_other_than_ok_is_answered_as_a_status", async () => {
      const outcome = await client.call(
        grpcOf("SayHello", { name: "nobody" }),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "status",
        code: 5,
        message: "No such person",
      });
    });
  });

  describe("authentication", () => {
    it.each<[string, Authentication]>([
      ["bearer", { kind: "bearer", token: TOKEN }],
      ["basic", { kind: "basic", username: "ada", password: "lovelace" }],
      ["secret", { kind: "secret", scheme: "bearer", secret: "greeter" }],
    ])(
      "%s_credentials_are_not_sent_over_a_plaintext_channel",
      async (_scheme, authentication) => {
        const request = grpcOf("SayHello", { name: "Ada" }, authentication);

        const outcome = await client.call(
          request,
          contextOf({ greeter: { token: TOKEN } }),
        );

        expect(outcome).toEqual({
          kind: "misconfigured",
          detail:
            "Credentials are not sent to a gRPC service over a plaintext channel",
        });
        expect(received).toHaveLength(0);
      },
    );

    it("the_proto_is_read_with_the_authentication_of_its_resource", async () => {
      const plain = grpcOf("SayHello", { name: "Ada" });
      const request: GrpcRequest = {
        ...plain,
        proto: {
          name: null,
          endpoint: {
            uri: `${protos.origin}/private.proto`,
            authentication: {
              kind: "basic",
              username: "ada",
              password: "lovelace",
            },
          },
        },
      };

      const outcome = await client.call(request, contextOf());

      expect(outcome).toMatchObject({ kind: "replied" });
    });

    it("a_proto_whose_server_refuses_the_credentials_is_rejected_with_its_status", async () => {
      const plain = grpcOf("SayHello", { name: "Ada" });
      const request: GrpcRequest = {
        ...plain,
        proto: {
          name: null,
          endpoint: {
            uri: `${protos.origin}/private.proto`,
            authentication: null,
          },
        },
      };

      const outcome = await client.call(request, contextOf());

      expect(outcome).toEqual({
        kind: "rejected",
        statusCode: 401,
        detail: "The server answered the resource with status 401",
      });
    });
  });

  describe("the channel", () => {
    const chosen = new Error("The channel security was chosen");

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("a_public_service_is_called_over_tls_on_any_port", async () => {
      const secure = vi
        .spyOn(credentials, "createSsl")
        .mockImplementation(() => {
          throw chosen;
        });
      const addresses = new PublicAddresses([]);
      const tls = new GrpcClient(
        addresses,
        http,
        authentication,
        new ProtoSchema(),
        new TransportFailures(),
        responseSizeLimit,
        resilience,
      );
      const request = grpcOf(
        "SayHello",
        { name: "Ada" },
        {
          kind: "bearer",
          token: TOKEN,
        },
      );

      const called = tls.call(request, contextOf());

      await expect(called).rejects.toBe(chosen);
      expect(secure).toHaveBeenCalledOnce();
      await addresses.onApplicationShutdown();
    });

    it("calls_to_one_service_share_its_channel_until_the_client_shuts_down", async () => {
      client.onApplicationShutdown();
      const opened = vi.spyOn(credentials, "createInsecure");
      const request = grpcOf("SayHello", { name: "Ada" });

      await client.call(request, contextOf());
      await client.call(request, contextOf());
      client.onApplicationShutdown();
      const reopened = await client.call(request, contextOf());

      expect(reopened).toMatchObject({ kind: "replied" });
      expect(opened).toHaveBeenCalledTimes(2);
    });

    it("a_private_service_on_another_port_is_called_in_plaintext", async () => {
      client.onApplicationShutdown();
      const plain = vi.spyOn(credentials, "createInsecure");
      const request = grpcOf("SayHello", { name: "Ada" });

      const outcome = await client.call(request, contextOf());

      expect(outcome).toMatchObject({ kind: "replied" });
      expect(plain).toHaveBeenCalledOnce();
    });

    it("a_private_service_on_the_tls_port_is_called_over_tls", async () => {
      const secure = vi
        .spyOn(credentials, "createSsl")
        .mockImplementation(() => {
          throw chosen;
        });
      const request: GrpcRequest = {
        ...grpcOf("SayHello", { name: "Ada" }),
        service: { name: "GreeterApi.Greeter", host: "127.0.0.1", port: 443 },
      };

      const called = client.call(request, contextOf());

      await expect(called).rejects.toBe(chosen);
      expect(secure).toHaveBeenCalledOnce();
    });
  });

  describe("the description", () => {
    it.each([
      [
        "a_service_the_proto_lacks",
        { service: { name: "GreeterApi.Missing", host: "127.0.0.1", port: 1 } },
        "The proto describes no service GreeterApi.Missing",
      ],
      [
        "a_message_type_named_as_a_service",
        {
          service: {
            name: "GreeterApi.HelloRequest",
            host: "127.0.0.1",
            port: 1,
          },
        },
        "The proto describes no service GreeterApi.HelloRequest",
      ],
      [
        "a_method_the_service_lacks",
        { method: "SayGoodbye" },
        "The service GreeterApi.Greeter has no method SayGoodbye",
      ],
      [
        "a_method_that_streams_its_requests",
        { method: "Collect" },
        "The method Collect streams its requests, and a call sends one message",
      ],
      [
        "an_argument_the_request_does_not_have",
        { arguments: { name: "Ada", userID: "u-1" } },
        "The arguments do not fit the request of SayHello: .GreeterApi.HelloRequest has no field userID",
      ],
      [
        "a_nested_argument_the_message_does_not_have",
        { arguments: { stops: [{ town: "Kyiv" }] } },
        "The arguments do not fit the request of SayHello: .GreeterApi.Origin has no field town",
      ],
      [
        "arguments_that_do_not_fit_the_request",
        { arguments: { origin: "Paris" } },
        "The arguments do not fit the request of SayHello: .GreeterApi.HelloRequest.origin: object expected",
      ],
    ])("%s_is_misconfigured", async (_case, change, detail) => {
      const request: GrpcRequest = {
        ...grpcOf("SayHello", { name: "Ada" }),
        ...change,
      };

      const outcome = await client.call(request, contextOf());

      expect(outcome).toEqual({ kind: "misconfigured", detail });
      expect(received).toHaveLength(0);
    });

    it.each([
      [
        "/broken.proto",
        "The proto cannot be read: illegal service name '{' (line 1)",
      ],
      [
        "/importing.proto",
        "The proto imports other.proto, which is not a well-known type",
      ],
    ])("the_proto_at_%s_is_misconfigured", async (path, detail) => {
      const plain = grpcOf("SayHello", { name: "Ada" });
      const request: GrpcRequest = {
        ...plain,
        proto: {
          name: null,
          endpoint: { uri: `${protos.origin}${path}`, authentication: null },
        },
      };

      const outcome = await client.call(request, contextOf());

      expect(outcome).toEqual({ kind: "misconfigured", detail });
    });

    it("a_proto_the_server_does_not_have_is_rejected_with_its_status", async () => {
      const plain = grpcOf("SayHello", { name: "Ada" });
      const request: GrpcRequest = {
        ...plain,
        proto: {
          name: null,
          endpoint: {
            uri: `${protos.origin}/missing.proto`,
            authentication: null,
          },
        },
      };

      const outcome = await client.call(request, contextOf());

      expect(outcome).toEqual({
        kind: "rejected",
        statusCode: 404,
        detail: "The server answered the resource with status 404",
      });
    });
  });

  describe("failures", () => {
    it("a_call_still_unanswered_at_its_deadline_expires", async () => {
      const outcome = await client.call(
        grpcOf("SayHello", { name: "hang" }),
        contextOf({}, 300),
      );

      expect(outcome).toEqual({ kind: "expired" });
    });

    it("a_port_nobody_listens_on_is_unreachable", async () => {
      const closed = await closedPort();
      const request: GrpcRequest = {
        ...grpcOf("SayHello", { name: "Ada" }),
        service: {
          name: "GreeterApi.Greeter",
          host: "127.0.0.1",
          port: closed,
        },
      };

      const outcome = await client.call(request, contextOf());

      expect(outcome).toEqual({
        kind: "unreachable",
        detail: "The service could not be reached",
      });
    });

    it.each(["127.0.0.1", "localhost"])(
      "a_private_destination_%s_is_refused_before_any_connection",
      async (host) => {
        const guarded = new GrpcClient(
          new AddressPolicy([]),
          http,
          authentication,
          new ProtoSchema(),
          new TransportFailures(),
          responseSizeLimit,
          resilience,
        );
        const request: GrpcRequest = {
          ...grpcOf("SayHello", { name: "Ada" }),
          service: { name: "GreeterApi.Greeter", host, port },
        };

        const outcome = await guarded.call(request, contextOf());

        expect(outcome).toEqual({
          kind: "unreachable",
          detail: REFUSED_ADDRESS,
        });
        expect(received).toHaveLength(0);
      },
    );

    it("a_stream_larger_than_its_bound_is_resource_exhausted", async () => {
      const outcome = await client.call(
        grpcOf("SayHellos", { name: "flood" }),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "status",
        code: 8,
        message: "The response is larger than 1 MiB",
      });
    });

    it("a_message_larger_than_its_bound_is_resource_exhausted", async () => {
      const outcome = await client.call(
        grpcOf("SayHello", { name: "huge" }),
        contextOf(),
      );

      expect(outcome).toMatchObject({ kind: "status", code: 8 });
    });
  });
});

function greeterService(): ServiceClientConstructor["service"] {
  const parsed = parse(PROTO, { keepCase: true });
  const timestamp = common.get("google/protobuf/timestamp.proto");
  assert.exists(timestamp?.nested);
  parsed.root.addJSON(timestamp.nested);
  const json = parsed.root.toJSON();
  const loaded = loadPackageDefinition(fromJSON(json));
  const api = loaded.GreeterApi as { Greeter: ServiceClientConstructor };
  return api.Greeter.service;
}
