import { describe, expect, test } from "vitest";
import {
  type CloudEvent,
  type EventFilter,
  createSecretPolicies,
  endingOf,
  lifecycleEventCatalogue,
  stateFormatVersion,
} from "../src/index.js";
import { analyzer } from "./support/analyzer.js";
import {
  fullOptions,
  fullProfile,
  interpreter,
  programOf,
  startContext,
} from "./support/interpreter.js";

const greet = `
document:
  dsl: '1.1.0'
  namespace: test
  name: greet
  version: '0.1.0'
do:
  - greet:
      set:
        greeting: Hello
`;

const recursive = `
document:
  dsl: '1.1.0'
  namespace: test
  name: recursive
  version: '0.1.0'
use:
  functions:
    countdown:
      call: countdown
do:
  - start:
      call: countdown
`;

const scheduled = `
document:
  dsl: '1.1.0'
  namespace: test
  name: report
  version: '0.1.0'
schedule:
  every: PT1M
use:
  secrets:
    - apiKey
do:
  - fetch:
      call: http
      with:
        method: get
        endpoint: https://example.com/report
  - pause:
      wait: PT1S
`;

const pinged = `
document:
  dsl: '1.1.0'
  namespace: test
  name: pinged
  version: '0.1.0'
schedule:
  on:
    one:
      with:
        type: com.example.ping
do:
  - greet:
      set:
        greeting: Hello
`;

const scheduledOptions = {
  ...fullOptions,
  profile: { ...fullOptions.profile, secrets: ["apiKey"] },
};

function eventOf(type: string, data: CloudEvent["data"]): CloudEvent {
  return {
    specversion: "1.0",
    id: "e-1",
    source: "https://example.com",
    type,
    data,
  };
}

function filterOf(
  filter: Parameters<typeof interpreter.filter>[0],
): EventFilter {
  const compilation = interpreter.filter(filter);

  if (compilation.kind === "refused") {
    throw new Error("The interpreter refused the filter.");
  }

  return compilation.filter;
}

describe("compile", () => {
  test("compiles a document into a program whose start completes with its output", () => {
    const program = programOf(greet);

    const step = program.start(null, startContext);

    expect(step).toMatchObject({
      status: "completed",
      output: { greeting: "Hello" },
    });
  });

  test("refuses a text that does not read with the syntax diagnostic alone", () => {
    const compilation = interpreter.compile("do: [", fullOptions);

    expect(compilation).toMatchObject({
      kind: "refused",
      diagnostics: [{ code: "syntax" }],
    });
  });

  test("refuses a document with the diagnostics of its analysis, and throws nothing", () => {
    const compilation = interpreter.compile(recursive, fullOptions);

    expect(compilation).toMatchObject({
      kind: "refused",
      diagnostics: [
        {
          code: "recursive-function",
          message: "Function 'countdown' reaches itself.",
          pointer: "/use/functions/countdown/call",
          range: {
            start: { line: 10, column: 13 },
            end: { line: 10, column: 22 },
          },
          subject: "countdown",
          import: null,
        },
      ],
    });
  });

  test("refuses a document as the editor’s analysis does", () => {
    const compilation = interpreter.compile(recursive, fullOptions);
    const analysis = analyzer.analyze(recursive, fullOptions);

    expect(compilation).toMatchObject({
      kind: "refused",
      diagnostics: analysis.diagnostics,
    });
  });

  test("gives with the program, and with a refusal, the analysis it made of the document", () => {
    const compiled = interpreter.compile(greet, fullOptions);
    const refused = interpreter.compile(`${greet}      nope: 1\n`, fullOptions);
    const header = {
      dsl: "1.1.0",
      namespace: "test",
      name: "greet",
      version: "0.1.0",
    };
    const tasks = [{ greet: { set: { greeting: "Hello" } } }];

    expect(compiled).toMatchObject({
      kind: "compiled",
      analysis: {
        kind: "analyzed",
        model: { source: { document: { document: header, do: tasks } } },
      },
    });
    expect(refused).toMatchObject({
      kind: "refused",
      analysis: {
        kind: "refused",
        source: {
          document: {
            document: header,
            do: [{ greet: { set: { greeting: "Hello" }, nope: 1 } }],
          },
        },
      },
    });
  });

  test("gives one document one fingerprint, and another document another", () => {
    const first = programOf(greet);
    const second = programOf(greet);
    const other = programOf(scheduled, scheduledOptions);

    expect(second.fingerprint).toBe(first.fingerprint);
    expect(other.fingerprint).not.toBe(first.fingerprint);
  });
});

describe("the manifest", () => {
  test("lists what the host must provide: identity, effects, secrets and schedules", () => {
    const program = programOf(scheduled, scheduledOptions);

    expect(program.manifest).toEqual({
      identity: {
        namespace: "test",
        name: "report",
        version: "0.1.0",
        dsl: "1.1.0",
      },
      effects: ["http", "timer"],
      secrets: ["apiKey"],
      schedules: [{ kind: "every", interval: 60000 }],
      filters: [],
    });
  });

  test("names the event types an event-driven start consumes", () => {
    const program = programOf(`
document:
  dsl: '1.1.0'
  namespace: test
  name: paired
  version: '0.1.0'
schedule:
  on:
    all:
      - with:
          type: com.example.order.placed
      - with:
          type: com.example.order.paid
do:
  - greet:
      set:
        greeting: Hello
`);

    expect(program.manifest.schedules).toMatchObject([
      {
        kind: "on",
        types: ["com.example.order.placed", "com.example.order.paid"],
      },
    ]);
  });

  test("routes the events of an event-driven start by its filters", () => {
    const program = programOf(pinged);
    const [filter] = program.manifest.filters;
    const ping = eventOf("com.example.ping", {});
    const pong = eventOf("com.example.pong", {});

    expect(filter?.accepts(ping)).toBe(true);
    expect(filter?.accepts(pong)).toBe(false);
  });

  test("is frozen: a host write throws and the manifest stays as written", () => {
    const program = programOf(scheduled, scheduledOptions);
    const effects = program.manifest.effects as string[];

    const writing = () => effects.push("grpc");

    expect(writing).toThrow(TypeError);
    expect(program.manifest.effects).toEqual(["http", "timer"]);
  });
});

describe("filter", () => {
  test("accepts an event of the type it names, and refuses a type it is only a prefix of", () => {
    const filter = filterOf({ with: { type: "com.example.ping" } });
    const ping = eventOf("com.example.ping", {});
    const versioned = eventOf("com.example.ping.v2", {});

    expect(filter.accepts(ping)).toBe(true);
    expect(filter.accepts(versioned)).toBe(false);
  });

  test("decides a condition on the data with no run", () => {
    const filter = filterOf({
      with: { type: "com.example.order", data: "${ .total > 100 }" },
    });
    const large = eventOf("com.example.order", { total: 150 });
    const small = eventOf("com.example.order", { total: 50 });

    expect(filter.accepts(large)).toBe(true);
    expect(filter.accepts(small)).toBe(false);
  });

  test("refuses a filter on an empty type: no event has one", () => {
    const compilation = interpreter.filter({ with: { type: "" } });

    expect(compilation).toMatchObject({
      kind: "refused",
      diagnostics: [
        { code: "event-attribute", pointer: "/with/type", subject: "type" },
      ],
    });
  });

  test("refuses a correlation: a filter outside a run keeps no expectation between events", () => {
    const compilation = interpreter.filter({
      with: { type: "com.example.paid" },
      correlate: { order: { from: "${ .data.order }" } },
    });

    expect(compilation).toStrictEqual({
      kind: "refused",
      diagnostics: [
        {
          code: "schema",
          message:
            "A filter outside a run must not correlate: it keeps no expectation between events.",
          pointer: "/correlate",
          range: null,
          subject: null,
          import: null,
        },
      ],
    });
  });
});

describe("a run the host ends itself", () => {
  const identity = {
    namespace: "test",
    name: "report",
    version: "0.1.0",
    dsl: "1.1.0",
  };

  test("ends faulted with the standard's runtime error and its workflow.faulted event", () => {
    const ending = endingOf({
      identity,
      instance: "instance-1",
      phase: "faulted",
      detail: "The platform could not run the instance.",
      now: startContext.now,
    });
    const error = {
      type: "https://open-workflow-specification.org/spec/1.0.0/errors/runtime",
      status: 500,
      title: "Runtime Error",
      detail: "The platform could not run the instance.",
      instance: "",
    };

    expect(ending).toEqual({
      events: [
        {
          subject: "workflow",
          name: "workflow.faulted",
          types: [
            "org.open-workflow-specification.workflow.faulted.v1",
            "io.serverlessworkflow.workflow.faulted.v1",
          ],
          data: {
            name: "report-instance-1.test",
            faultedAt: "2026-01-01T00:00:00.000Z",
            error,
          },
        },
      ],
      error,
    });
  });

  test("ends cancelled with its workflow.cancelled event and no error", () => {
    const ending = endingOf({
      identity,
      instance: "instance-1",
      phase: "cancelled",
      now: startContext.now,
    });

    expect(ending).toEqual({
      events: [
        {
          subject: "workflow",
          name: "workflow.cancelled",
          types: [
            "org.open-workflow-specification.workflow.cancelled.v1",
            "io.serverlessworkflow.workflow.cancelled.v1",
          ],
          data: {
            name: "report-instance-1.test",
            cancelledAt: "2026-01-01T00:00:00.000Z",
          },
        },
      ],
      error: null,
    });
  });
});

describe("the lifecycle event catalogue", () => {
  test("names each event's types and the data field of its moment", () => {
    expect(lifecycleEventCatalogue["task.started"]).toEqual({
      at: "startedAt",
      once: false,
      ending: false,
      types: [
        "org.open-workflow-specification.task.started.v1",
        "io.serverlessworkflow.task.started.v1",
      ],
    });
  });

  test("marks the events an instance reports at most once", () => {
    const entries = Object.entries(lifecycleEventCatalogue);
    const once = entries.filter(([, entry]) => entry.once);
    const names = once.map(([name]) => name);

    expect(names).toEqual([
      "workflow.started",
      "workflow.correlation-started",
      "workflow.correlation-completed",
      "workflow.cancelled",
      "workflow.faulted",
      "workflow.completed",
    ]);
  });

  test("marks the events that end their workflow or their task", () => {
    const entries = Object.entries(lifecycleEventCatalogue);
    const ending = entries.filter(([, entry]) => entry.ending);
    const names = ending.map(([name]) => name);

    expect(names).toEqual([
      "workflow.cancelled",
      "workflow.faulted",
      "workflow.completed",
      "task.cancelled",
      "task.faulted",
      "task.completed",
    ]);
  });

  test("lists the events a run reports, and no status change", () => {
    const names = Object.keys(lifecycleEventCatalogue);

    expect(names).toEqual([
      "workflow.started",
      "workflow.suspended",
      "workflow.resumed",
      "workflow.correlation-started",
      "workflow.correlation-completed",
      "workflow.cancelled",
      "workflow.faulted",
      "workflow.completed",
      "task.created",
      "task.started",
      "task.suspended",
      "task.resumed",
      "task.retried",
      "task.cancelled",
      "task.faulted",
      "task.completed",
    ]);
  });
});

describe("a policy a secret holds", () => {
  const policies = createSecretPolicies();

  test("decodes a basic policy as its credentials", () => {
    const secret = { username: "ann", password: "s3cret" };

    const authentication = policies.authenticationOf(
      "basic",
      secret,
      fullProfile,
    );

    expect(authentication).toEqual({
      kind: "basic",
      username: "ann",
      password: "s3cret",
    });
  });

  test("decodes an OAuth2 policy with the standard's defaults", () => {
    const secret = {
      authority: "https://auth.example.com",
      grant: "client_credentials",
      client: { id: "app", secret: "s3cret" },
    };

    const authentication = policies.authenticationOf(
      "oauth2",
      secret,
      fullProfile,
    );

    expect(authentication).toEqual({
      kind: "oauth2",
      authority: "https://auth.example.com",
      endpoints: {
        token: "/oauth2/token",
        revocation: "/oauth2/revoke",
        introspection: "/oauth2/introspect",
      },
      grant: "client_credentials",
      client: {
        id: "app",
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
    });
  });

  test.each([
    {
      held: "a policy its scheme's grammar refuses",
      scheme: "basic" as const,
      secret: { username: "ann" },
      reason: "Password is required.",
    },
    {
      held: "a member the grammar does not know",
      scheme: "bearer" as const,
      secret: { token: "t", note: "x" },
      reason: "Unknown property note.",
    },
    {
      held: "the name of another secret",
      scheme: "bearer" as const,
      secret: { use: "other" },
      reason: "A secret holds its policy, not another secret.",
    },
    {
      held: "a grant the host does not provide",
      scheme: "oidc" as const,
      secret: { authority: "https://auth.example.com", grant: "password" },
      reason: "The host does not provide 'password'.",
    },
  ])("refuses $held", ({ scheme, secret, reason }) => {
    const profile = { ...fullProfile, grants: ["client_credentials"] as const };

    const authentication = policies.authenticationOf(scheme, secret, profile);

    expect(authentication).toEqual({ kind: "refused", reason });
  });
});

describe("the entry", () => {
  test("exports at run time the interpreter, the secret policies, the host's ending, the event catalogue and the state format alone", async () => {
    const entry = await import("../src/index.js");
    const names = Object.keys(entry).toSorted();

    expect(names).toEqual([
      "createInterpreter",
      "createSecretPolicies",
      "endingOf",
      "lifecycleEventCatalogue",
      "stateFormatVersion",
    ]);
  });

  test("gives the state format 1", () => {
    expect(stateFormatVersion).toBe(1);
  });
});
