import type { Failure, Resource } from "interpreter";
import { ImportRefusal } from "../../../../../src/application/automation/imports/enums.js";
import { HttpImportGateway } from "../../../../../src/interface-adapters/workflows/gateways/http-import.gateway.js";
import {
  type FetchedText,
  ResourceClient,
  type StepCall,
} from "../../../../../src/interface-adapters/workflows/interfaces.js";

const URI = "https://imports.test/library.yaml";
const TEXT = "document: { dsl: 1.0.0 }";
const DETAIL = "The service refused the connection";
const EXPIRED = "The import's server did not answer within the time limit";

class ScriptedResources extends ResourceClient {
  readonly resources: Resource[] = [];
  readonly steps: StepCall[] = [];

  constructor(private readonly answer: FetchedText) {
    super();
  }

  text(resource: Resource, step: StepCall): Promise<FetchedText> {
    this.resources.push(resource);
    this.steps.push(step);
    return Promise.resolve(this.answer);
  }
}

describe("an import the host fetches over HTTP", () => {
  it("the_text_of_the_resource_at_the_uri_is_the_import", async () => {
    const resources = new ScriptedResources({ kind: "text", text: TEXT });
    const gateway = new HttpImportGateway(resources);

    const fetched = await gateway.fetch(URI);

    expect(fetched).toEqual({ ok: true, value: { text: TEXT } });
    expect(resources.resources).toEqual([
      { name: null, endpoint: { uri: URI, authentication: null } },
    ]);
    expect(resources.steps[0]?.secrets).toEqual({});
  });

  it.each([
    ["expired", { kind: "expired" }, ImportRefusal.Expired, EXPIRED],
    [
      "unreachable",
      { kind: "unreachable", detail: DETAIL },
      ImportRefusal.Unreachable,
      DETAIL,
    ],
    [
      "rejected",
      { kind: "rejected", statusCode: 404, detail: DETAIL },
      ImportRefusal.Rejected,
      DETAIL,
    ],
    [
      "unauthenticated",
      { kind: "unauthenticated", detail: DETAIL },
      ImportRefusal.Unauthenticated,
      DETAIL,
    ],
    [
      "forbidden",
      { kind: "forbidden", detail: DETAIL },
      ImportRefusal.Misconfigured,
      DETAIL,
    ],
    [
      "misconfigured",
      { kind: "misconfigured", detail: DETAIL },
      ImportRefusal.Misconfigured,
      DETAIL,
    ],
  ] satisfies [string, Failure, ImportRefusal, string][])(
    "a_resource_that_fails_as_%s_is_refused_with_its_import_refusal",
    async (_kind, failure, refusal, detail) => {
      const resources = new ScriptedResources(failure);
      const gateway = new HttpImportGateway(resources);

      const fetched = await gateway.fetch(URI);

      expect(fetched).toEqual({ ok: false, failure: { refusal, detail } });
    },
  );
});
