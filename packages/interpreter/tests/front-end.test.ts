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
