import { ImportRefusal } from "../../../../src/application/automation/imports/enums.js";
import { HOST_PROFILE } from "../../../../src/frameworks/interpreter/host-profile.js";
import { Authenticator } from "../../../../src/interface-adapters/auth/authenticator.js";
import { AccessTokens } from "../../../../src/interface-adapters/auth/interfaces.js";
import { TransportFailure } from "../../../../src/interface-adapters/http/enums.js";
import { ImportGateway } from "../../../../src/interface-adapters/http/import.gateway.js";
import {
  HttpClient,
  type HttpReply,
  type OutboundRequest,
  type TextReply,
} from "../../../../src/interface-adapters/http/interfaces.js";
import { ResourceGateway } from "../../../../src/interface-adapters/http/resource.gateway.js";
import { TransportFault } from "../../../../src/interface-adapters/http/transport-fault.error.js";

const URI = "https://imports.test/library.yaml";
const TEXT = "document: { dsl: 1.0.0 }";
const DETAIL = "The service refused the connection";
const EXPIRED = "The import's server did not answer within the time limit";

class NoTokens extends AccessTokens {
  accessTokenFor(): Promise<string> {
    return Promise.reject(new Error("An import asks for no token"));
  }
}

class ScriptedClient extends HttpClient {
  readonly requests: OutboundRequest[] = [];

  constructor(private readonly answer: TextReply | TransportFault) {
    super();
  }

  admits(): Promise<boolean> {
    return Promise.resolve(true);
  }

  exchange(): Promise<HttpReply> {
    return Promise.reject(new Error("An import reads text"));
  }

  text(request: OutboundRequest): Promise<TextReply> {
    this.requests.push(request);

    if (this.answer instanceof TransportFault)
      return Promise.reject(this.answer);

    return Promise.resolve(this.answer);
  }
}

function gatewayOf(client: ScriptedClient): ImportGateway {
  const authenticator = new Authenticator(new NoTokens(), HOST_PROFILE);
  const resources = new ResourceGateway(client, authenticator);
  return new ImportGateway(resources);
}

describe("an import the host fetches over HTTP", () => {
  it("the_text_of_the_resource_at_the_uri_is_the_import", async () => {
    const client = new ScriptedClient({ statusCode: 200, text: TEXT });
    const gateway = gatewayOf(client);

    const fetched = await gateway.fetch(URI);

    expect(fetched).toEqual({ ok: true, value: { text: TEXT } });
    expect(client.requests.map((request) => request.uri)).toEqual([URI]);
    expect(client.requests[0]?.headers.has("authorization")).toBe(false);
  });

  it("a_resource_the_server_refuses_is_refused_as_rejected", async () => {
    const client = new ScriptedClient({ statusCode: 404, text: "" });
    const gateway = gatewayOf(client);

    const fetched = await gateway.fetch(URI);

    expect(fetched).toEqual({
      ok: false,
      failure: {
        refusal: ImportRefusal.Rejected,
        detail: "The server answered the resource with status 404",
      },
    });
  });

  it.each([
    ["expired", TransportFailure.Expired, ImportRefusal.Expired, EXPIRED],
    [
      "unreachable",
      TransportFailure.Unreachable,
      ImportRefusal.Unreachable,
      DETAIL,
    ],
    [
      "unauthenticated",
      TransportFailure.Unauthenticated,
      ImportRefusal.Unauthenticated,
      DETAIL,
    ],
    [
      "misconfigured",
      TransportFailure.Misconfigured,
      ImportRefusal.Misconfigured,
      DETAIL,
    ],
  ] as const)(
    "a_resource_that_fails_as_%s_is_refused_with_its_import_refusal",
    async (_kind, reason, refusal, detail) => {
      const fault = new TransportFault(reason, DETAIL);
      const gateway = gatewayOf(new ScriptedClient(fault));

      const fetched = await gateway.fetch(URI);

      expect(fetched).toEqual({ ok: false, failure: { refusal, detail } });
    },
  );
});
