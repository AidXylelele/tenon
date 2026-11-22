import { describe, expect, test } from "vitest";
import {
  type BinderBinding,
  type Binding,
  type JsonObject,
  type JsonValue,
  resolutionsOf,
  type SemanticModel,
} from "../src/front-end.js";
import { analyzer } from "./support/analyzer.js";
import { fullOptions } from "./support/interpreter.js";

const header = {
  dsl: "1.1.0",
  namespace: "test",
  name: "orders",
  version: "0.1.0",
};

const looped = {
  document: header,
  do: [
    {
      each: {
        for: { in: ".orders", each: "order" },
        do: [{ total: { set: { sum: "${ $order.price * $index }" } } }],
      },
    },
  ],
};

const order: BinderBinding = {
  kind: "binder",
  declaration: "/do/0/each",
  role: "item",
  name: "order",
};

const index: BinderBinding = {
  kind: "binder",
  declaration: "/do/0/each",
  role: "index",
  name: "index",
};

function modelOf(document: JsonValue): SemanticModel {
  const analysis = analyzer.analyze(document, fullOptions);

  if (analysis.kind === "refused") {
    const diagnostics = JSON.stringify(analysis.diagnostics);
    throw new Error(`The analyzer refused the document: ${diagnostics}`);
  }

  return analysis.model;
}

function conditioned(condition: string): JsonObject {
  return {
    document: header,
    do: [{ greet: { if: condition, set: { greeting: "Hello" } } }],
  };
}

describe("resolutionsOf", () => {
  test("gives an expression, the names in scope at it and the names it reads", () => {
    const model = modelOf(looped);

    const resolutions = resolutionsOf(model, "/do/0/each/do/0/total/set/sum");

    expect(resolutions).toEqual([
      {
        expression: {
          kind: "expression",
          pointer: "/do/0/each/do/0/total/set/sum",
          source: "$order.price * $index",
          sourceOffset: 3,
          mode: "strict",
        },
        scope: new Map<string, Binding>([
          ["context", { kind: "argument", argument: "context" }],
          ["input", { kind: "argument", argument: "input" }],
          ["secrets", { kind: "argument", argument: "secrets" }],
          ["task", { kind: "argument", argument: "task" }],
          ["workflow", { kind: "argument", argument: "workflow" }],
          ["runtime", { kind: "argument", argument: "runtime" }],
          ["order", order],
          ["index", index],
        ]),
        bindings: new Map([
          ["order", order],
          ["index", index],
        ]),
      },
    ]);
  });

  test("binds a name to the binder that hides the runtime argument of that name", () => {
    const model = modelOf({
      document: header,
      do: [
        {
          each: {
            for: { in: ".orders", each: "input" },
            do: [{ total: { set: { sum: "${ $input.price }" } } }],
          },
        },
      ],
    });

    const [resolution] = resolutionsOf(model, "/do/0/each/do/0/total/set/sum");

    expect(resolution?.bindings.get("input")).toEqual({
      kind: "binder",
      declaration: "/do/0/each",
      role: "item",
      name: "input",
    });
  });

  test("gives an expression of a named component once for each place that names it, in that place's scope", () => {
    const model = modelOf({
      document: header,
      use: { timeouts: { brief: { after: "${ $workflow.input.limit }" } } },
      do: [
        { first: { set: { x: 1 }, timeout: "brief" } },
        {
          each: {
            for: { in: ".orders", each: "order" },
            do: [{ second: { set: { x: 2 }, timeout: "brief" } }],
          },
        },
      ],
    });

    const resolutions = resolutionsOf(model, "/use/timeouts/brief/after");
    const scopes = resolutions.map(({ scope }) => [...scope.keys()]);

    expect(scopes).toEqual([
      ["context", "secrets", "task", "workflow", "runtime"],
      ["context", "secrets", "task", "workflow", "runtime", "order", "index"],
    ]);
  });

  test("gives nothing, frozen, where no expression is written", () => {
    const model = modelOf(looped);

    const resolutions = resolutionsOf(model, "/do/0/each/for/each");

    expect(resolutions).toEqual([]);
    expect(Object.isFrozen(resolutions)).toBe(true);
  });

  test.each([
    [".ready", 0],
    ["${ .ready }", 3],
    ["  ${.ready  }", 4],
  ])("finds the source of '%s' at offset %i of its text", (text, offset) => {
    const model = modelOf(conditioned(text));

    const [resolution] = resolutionsOf(model, "/do/0/greet/if");

    expect(resolution?.expression).toMatchObject({
      source: ".ready",
      sourceOffset: offset,
    });
  });
});

describe("analyze", () => {
  const unaddressed = `
document:
  dsl: '1.1.0'
  namespace: test
  name: fetch
  version: '0.1.0'
do:
  - fetch:
      call: http
      with:
        method: get
        endpoint: ''
`;

  function grpcCalled(port: number): JsonObject {
    return {
      document: header,
      do: [
        {
          greet: {
            call: "grpc",
            with: {
              proto: { endpoint: "https://example.com/greeter.proto" },
              service: { name: "Greeter", host: "example.com", port },
              method: "SayHello",
            },
          },
        },
      ],
    };
  }

  function fetchedAt(endpoint: JsonValue): JsonObject {
    return {
      document: header,
      do: [{ fetch: { call: "http", with: { method: "get", endpoint } } }],
    };
  }

  test("models the task whose endpoint is still empty", () => {
    const analysis = analyzer.analyze(unaddressed, fullOptions);

    expect(analysis).toMatchObject({
      kind: "analyzed",
      model: {
        workflow: {
          do: {
            tasks: [
              {
                name: "fetch",
                call: {
                  kind: "http",
                  endpoint: { uri: { kind: "literal", value: "" } },
                },
              },
            ],
          },
        },
      },
    });
  });

  test("reports the empty endpoint once, at its range", () => {
    const analysis = analyzer.analyze(unaddressed, fullOptions);

    expect(analysis.diagnostics).toEqual([
      {
        code: "schema",
        message: "Endpoint is not in the form the standard requires.",
        pointer: "/do/0/fetch/with/endpoint",
        range: {
          start: { line: 12, column: 19 },
          end: { line: 12, column: 21 },
        },
        subject: null,
        import: null,
      },
    ]);
  });

  test.each([
    [
      "pattern",
      "a workflow name left empty",
      "analyzed",
      "/document/name",
      { document: { ...header, name: "" }, do: [{ a: { set: { x: 1 } } }] },
    ],
    [
      "pattern",
      "an endpoint in none of its forms",
      "analyzed",
      "/do/0/fetch/with/endpoint",
      fetchedAt(""),
    ],
    [
      "pattern",
      "the URI of an endpoint written as an object",
      "analyzed",
      "/do/0/fetch/with/endpoint/uri",
      fetchedAt({ uri: "" }),
    ],
    [
      "pattern",
      "an endpoint expression with nothing inside",
      "analyzed",
      "/do/0/fetch/with/endpoint",
      fetchedAt("${}"),
    ],
    [
      "pattern",
      "a wait in neither form of a duration",
      "analyzed",
      "/do/0/pause/wait",
      { document: header, do: [{ pause: { wait: "PT1X" } }] },
    ],
    [
      "format",
      "an event time that is no date and time",
      "analyzed",
      "/do/0/tell/emit/event/with/time",
      {
        document: header,
        do: [
          {
            tell: {
              emit: {
                event: {
                  with: {
                    source: "https://example.com",
                    type: "com.example.event",
                    time: "yesterday",
                  },
                },
              },
            },
          },
        ],
      },
    ],
    [
      "minimum",
      "a gRPC port below 0",
      "analyzed",
      "/do/0/greet/with/service/port",
      grpcCalled(-1),
    ],
    [
      "maximum",
      "a gRPC port above 65535",
      "analyzed",
      "/do/0/greet/with/service/port",
      grpcCalled(65536),
    ],
    [
      "type",
      "an endpoint that is a number",
      "refused",
      "/do/0/fetch/with/endpoint",
      fetchedAt(42),
    ],
    [
      "type",
      "a gRPC port that is no integer and below 0",
      "refused",
      "/do/0/greet/with/service/port",
      grpcCalled(-1.5),
    ],
    [
      "required",
      "an HTTP call with no method beside an empty endpoint",
      "refused",
      "/do/0/fetch/with/endpoint",
      {
        document: header,
        do: [{ fetch: { call: "http", with: { endpoint: "" } } }],
      },
    ],
    [
      "required",
      "an empty authentication name, whose other schemes each require a member of their own",
      "refused",
      "/do/0/fetch/with/endpoint/authentication/use",
      fetchedAt({
        uri: "https://example.com",
        authentication: { use: "" },
      }),
    ],
    [
      "unevaluatedProperties",
      "an unknown member beside a container lifetime in neither form of a duration",
      "refused",
      "/do/0/start/run/container/lifetime/after",
      {
        document: header,
        do: [
          {
            start: {
              run: {
                container: {
                  image: "hello-world",
                  lifetime: { cleanup: "eventually", after: "PT1X" },
                },
                nope: 1,
              },
            },
          },
        ],
      },
    ],
    [
      "enum",
      "an HTTP output outside its enumeration",
      "refused",
      "/do/0/fetch/with/output",
      {
        document: header,
        do: [
          {
            fetch: {
              call: "http",
              with: {
                method: "get",
                endpoint: "https://example.com",
                output: "body",
              },
            },
          },
        ],
      },
    ],
    [
      "enum",
      "a script in a language the standard does not support",
      "refused",
      "/do/0/start/run/script/language",
      {
        document: header,
        do: [
          { start: { run: { script: { language: "ruby", code: "puts 1" } } } },
        ],
      },
    ],
    [
      "minProperties",
      "a set of no values",
      "refused",
      "/do/0/a/set",
      { document: header, do: [{ a: { set: {} } }] },
    ],
    [
      "maxProperties",
      "two tasks in one item, one with an empty endpoint",
      "refused",
      "/do/0/fetch/with/endpoint",
      {
        document: header,
        do: [
          {
            fetch: { call: "http", with: { method: "get", endpoint: "" } },
            greet: { set: { x: 1 } },
          },
        ],
      },
    ],
    [
      "minItems",
      "a switch of no cases",
      "refused",
      "/do/0/pick/switch",
      { document: header, do: [{ pick: { switch: [] } }] },
    ],
    [
      "dependentRequired",
      "a schedule read with no events, beside an interval in neither form of a duration",
      "refused",
      "/schedule/every",
      {
        document: header,
        schedule: { every: "PT1X", read: "data" },
        do: [{ a: { set: { x: 1 } } }],
      },
    ],
    [
      "not",
      "a container lifetime with a delay but no eventual cleanup, the delay in neither form of a duration",
      "refused",
      "/do/0/start/run/container/lifetime/after",
      {
        document: header,
        do: [
          {
            start: {
              run: {
                container: {
                  image: "hello-world",
                  lifetime: { cleanup: "never", after: "PT1X" },
                },
              },
            },
          },
        ],
      },
    ],
  ])(
    "a violation of %s, %s, leaves the document %s, with its diagnostic at %s",
    (_, __, kind, pointer, document) => {
      const analysis = analyzer.analyze(document, fullOptions);

      expect(analysis).toMatchObject({ kind, diagnostics: [{ pointer }] });
    },
  );

  test("refuses a document in a DSL version it does not support", () => {
    const document = {
      document: { ...header, dsl: "2.0.0" },
      do: [{ a: { set: { x: 1 } } }],
    };

    const analysis = analyzer.analyze(document, fullOptions);

    expect(analysis).toMatchObject({
      kind: "refused",
      diagnostics: [{ code: "dsl-version", pointer: "/document/dsl" }],
    });
  });
});

describe("schemasAt", () => {
  const fetched = {
    document: header,
    do: [
      {
        fetch: {
          call: "http",
          with: { method: "get", endpoint: "https://example.com" },
        },
      },
    ],
  };

  test.each([
    ["/do/0/fetch/with/output", ["raw", "content", "response"], true],
    ["/do/0/fetch/then", ["continue", "exit", "end"], false],
    ["/do/0/fetch/with/method", [], false],
  ])("at %s lists %j, closed: %s", (pointer, values, closed) => {
    const schemas = analyzer.schemasAt(fetched, pointer);

    expect(schemas).toMatchObject([{ values, closed }]);
  });
});

test("the entry exports at run time the analyzer, the resolutions' read and the standard's catalogues alone", async () => {
  const entry = await import("../src/front-end.js");
  const names = Object.keys(entry).toSorted();

  expect(names).toEqual([
    "createAnalyzer",
    "flowDirectives",
    "resolutionsOf",
    "runtimeArguments",
    "standardVersion",
    "taskKinds",
  ]);
});
