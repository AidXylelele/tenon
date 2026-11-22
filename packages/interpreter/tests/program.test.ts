import { describe, expect, test } from "vitest";
import type {
  EffectOutcome,
  LifecycleEvent,
  State,
  StepContext,
} from "../src/index.js";
import { programOf, restored, startContext } from "./support/interpreter.js";

const header = `document:
  dsl: '1.1.0'
  namespace: test
  name: program
  version: '0.1.0'
`;

const call = `${header}do:
  - getPet:
      call: http
      with:
        method: get
        endpoint: https://petstore.swagger.io/v2/pet/1
`;

const adoption = `${header}do:
  - getPet:
      input:
        from: '\${ { id: .petId } }'
      call: http
      with:
        method: get
        endpoint: https://petstore.swagger.io/v2/pet/1
      output:
        as: '\${ { name: .name } }'
  - greet:
      set:
        greeting: '\${ "Hello, " + .name }'
`;

const ordered = `${header}input:
  schema:
    document:
      type: object
      required: [customer]
      properties:
        customer: { type: string }
        count: { type: integer, minimum: 1 }
do:
  - greet:
      set:
        greeting: Hello
`;

const limitedCall = `${call}      timeout:
        after: PT5S
`;

const wait = `${header}do:
  - pause:
      wait: PT30S
  - done:
      set:
        waited: true
`;

const raise = `${header}do:
  - fail:
      raise:
        error:
          type: https://example.com/errors/broken
          status: 500
          title: Broken
`;

const guarded = `${header}do:
  - guarded:
      try:
        - fail:
            raise:
              error:
                type: https://example.com/errors/broken
                status: 500
      catch:
        errors:
          with:
            type: https://example.com/errors/broken
        as: err
        do:
          - recover:
              set:
                caught: \${ $err.status }
`;

const fork = `${header}do:
  - both:
      fork:
        branches:
          - left:
              wait: PT1S
          - right:
              set:
                side: right
`;

const race = `${header}do:
  - race:
      fork:
        compete: true
        branches:
          - slow:
              wait: PT1M
          - fast:
              wait: PT1S
`;

const brokenFork = `${header}do:
  - both:
      fork:
        branches:
          - slow:
              wait: PT1M
          - broken:
              do:
                - pause:
                    wait: PT1S
                - fail:
                    raise:
                      error:
                        type: https://example.com/errors/broken
                        status: 500
`;

const waitingFork = `${header}do:
  - both:
      fork:
        branches:
          - a:
              wait: PT1M
          - b:
              wait: PT2M
`;

const exportingFork = `${header}do:
  - both:
      fork:
        branches:
          - marking:
              set:
                marked: true
              export:
                as: '\${ { leaked: true } }'
          - other:
              set:
                other: true
  - read:
      set: '\${ { ctx: $context } }'
`;

const literal = `${header}do:
  - keep:
      set:
        items: [1, 2]
`;

const pet: EffectOutcome = {
  kind: "responded",
  request: {
    method: "GET",
    uri: "https://petstore.swagger.io/v2/pet/1",
    headers: {},
  },
  statusCode: 200,
  headers: { "content-type": "application/json" },
  content: { id: 1, name: "Milou" },
  authorization: null,
};

const elapsed: EffectOutcome = { kind: "elapsed" };

const expired: EffectOutcome = { kind: "expired" };

function contextAfter(milliseconds: number): StepContext {
  const now = startContext.now + milliseconds;

  return { ...startContext, now };
}

function namesOf(events: readonly LifecycleEvent[]): readonly string[] {
  return events.map((event) => event.name);
}

describe("effects and responses", () => {
  test("a call requests its effect under the id of its task", () => {
    const program = programOf(call);

    const started = program.start({}, startContext);

    expect(started.requested).toEqual([
      {
        id: "/do/0/getPet",
        deadline: null,
        kind: "http",
        method: "GET",
        endpoint: {
          uri: "https://petstore.swagger.io/v2/pet/1",
          authentication: null,
        },
        headers: {},
        body: null,
        output: "content",
        revealAuthorization: false,
      },
    ]);
  });

  test("the response under that id completes the run with the decoded content", () => {
    const program = programOf(call);
    const started = program.start({}, startContext);
    const state = restored(started.state);
    const response = { id: "/do/0/getPet", outcome: pet };

    const responded = program.respond(state, response, startContext);

    expect(responded).toMatchObject({
      status: "completed",
      output: { id: 1, name: "Milou" },
    });
  });

  test("a response under an id the run does not await is an interpreter fault", () => {
    const program = programOf(call);
    const started = program.start({}, startContext);
    const state = restored(started.state);
    const response = { id: "/do/9/none", outcome: pet };

    const responding = () => program.respond(state, response, startContext);

    expect(responding).toThrow(
      expect.objectContaining({
        name: "InterpreterError",
        message: "No fiber awaits the effect '/do/9/none'.",
      }),
    );
  });
});

describe("the tasks' inputs and outputs", () => {
  test("a task gives the input its input.from made when it takes it, and the output its output.as made when it completes", () => {
    const program = programOf(adoption);
    const started = program.start({ petId: 1, owner: "Ann" }, startContext);
    const state = restored(started.state);
    const response = { id: "/do/0/getPet", outcome: pet };

    const responded = program.respond(state, response, startContext);

    expect(started.taskInputs).toEqual([
      { execution: "/do/0/getPet", value: { id: 1 } },
    ]);
    expect(started.taskOutputs).toEqual([]);
    expect(responded.taskInputs).toEqual([
      { execution: "/do/1/greet", value: { name: "Milou" } },
    ]);
    expect(responded.taskOutputs).toEqual([
      { execution: "/do/0/getPet", value: { name: "Milou" } },
      { execution: "/do/1/greet", value: { greeting: "Hello, Milou" } },
    ]);
  });
});

describe("a start input", () => {
  test("is checked against the workflow's input schema with a sentence for each place", () => {
    const program = programOf(ordered);

    const problems = program.inputProblemsOf({ count: 0 });
    const accepted = program.inputProblemsOf({ customer: "Ann", count: 2 });

    expect(problems).toEqual([
      { pointer: "/customer", detail: "Customer is required." },
      { pointer: "/count", detail: "Count must be at least 1." },
    ]);
    expect(accepted).toEqual([]);
  });

  test("that the check refuses faults the run with the same sentences", () => {
    const program = programOf(ordered);

    const started = program.start({ count: 0 }, startContext);

    expect(started).toMatchObject({
      status: "faulted",
      error: {
        title: "Validation Error",
        detail: "Customer is required. Count must be at least 1.",
      },
    });
  });
});

describe("timers and deadlines", () => {
  test("a wait requests a timer due its duration after the step’s now", () => {
    const program = programOf(wait);

    const started = program.start({}, startContext);

    expect(started.requested).toEqual([
      {
        id: "/do/0/pause",
        deadline: null,
        kind: "timer",
        until: 1767225630000,
      },
    ]);
  });

  test("a task timeout is the deadline of the effect its task awaits", () => {
    const program = programOf(limitedCall);

    const started = program.start({}, startContext);

    expect(started.requested).toMatchObject([
      { id: "/do/0/getPet", deadline: 1767225605000 },
    ]);
  });

  test("an expired effect faults its task with a timeout error", () => {
    const program = programOf(limitedCall);
    const started = program.start({}, startContext);
    const state = restored(started.state);
    const response = { id: "/do/0/getPet", outcome: expired };
    const due = contextAfter(5000);

    const responded = program.respond(state, response, due);

    expect(responded).toMatchObject({
      status: "faulted",
      error: {
        type: "https://open-workflow-specification.org/spec/1.0.0/errors/timeout",
        status: 408,
        title: "Timeout",
        detail: "A time limit passed.",
        instance: "/do/0/getPet",
      },
    });
  });
});

describe("suspension and resumption", () => {
  test("suspend holds the run, its task suspended and nothing requested", () => {
    const program = programOf(wait);
    const started = program.start({}, startContext);
    const state = restored(started.state);

    const later = contextAfter(1000);

    const suspended = program.suspend(state, later);
    const names = namesOf(suspended.events);

    expect(suspended).toMatchObject({ status: "suspended", requested: [] });
    expect(names).toEqual(["workflow.suspended", "task.suspended"]);
  });

  test("a response while suspended is queued: no event, the run still suspended", () => {
    const program = programOf(wait);
    const started = program.start({}, startContext);
    const running = restored(started.state);
    const suspended = program.suspend(running, startContext);
    const state = restored(suspended.state);
    const response = { id: "/do/0/pause", outcome: elapsed };
    const due = contextAfter(30000);

    const queued = program.respond(state, response, due);

    expect(queued).toMatchObject({ status: "suspended", events: [] });
  });

  test("resume applies the queued response, and the run goes on to its end", () => {
    const program = programOf(wait);
    const started = program.start({}, startContext);
    const running = restored(started.state);
    const suspended = program.suspend(running, startContext);
    const held = restored(suspended.state);
    const response = { id: "/do/0/pause", outcome: elapsed };
    const due = contextAfter(30000);
    const queued = program.respond(held, response, due);
    const state = restored(queued.state);
    const later = contextAfter(31000);

    const resumed = program.resume(state, later);
    const names = namesOf(resumed.events);

    expect(resumed).toMatchObject({
      status: "completed",
      output: { waited: true },
    });
    expect(names.slice(0, 2)).toEqual(["workflow.resumed", "task.resumed"]);
  });
});

describe("cancellation", () => {
  test("cancel ends the run cancelled and withdraws the effect it awaited", () => {
    const program = programOf(wait);
    const started = program.start({}, startContext);
    const state = restored(started.state);

    const later = contextAfter(1000);

    const cancelled = program.cancel(state, later);
    const names = namesOf(cancelled.events);

    expect(cancelled).toMatchObject({
      status: "cancelled",
      requested: [],
      withdrawn: ["/do/0/pause"],
    });
    expect(names).toEqual(["task.cancelled", "workflow.cancelled"]);
  });
});

describe("errors raised and caught", () => {
  test("a raise faults the workflow with its error, the raising task its instance", () => {
    const program = programOf(raise);

    const started = program.start({}, startContext);

    expect(started).toMatchObject({
      status: "faulted",
      error: {
        type: "https://example.com/errors/broken",
        status: 500,
        title: "Broken",
        instance: "/do/0/fail",
      },
    });
  });

  test("a try catches an error of the type it names and runs its catch do", () => {
    const program = programOf(guarded);

    const started = program.start({}, startContext);

    expect(started).toMatchObject({
      status: "completed",
      output: { caught: 500 },
    });
  });
});

describe("fork and join", () => {
  test("a fork joins the outputs of its branches in their declaration order", () => {
    const program = programOf(fork);
    const started = program.start({}, startContext);
    const state = restored(started.state);
    const response = {
      id: "/do/0/both/fork/branches/0/left",
      outcome: elapsed,
    };

    const due = contextAfter(1000);

    const joined = program.respond(state, response, due);

    expect(joined).toMatchObject({
      status: "completed",
      output: [{}, { side: "right" }],
    });
  });

  test("a competing fork ends with its first branch and withdraws the other’s effect", () => {
    const program = programOf(race);
    const started = program.start({}, startContext);
    const state = restored(started.state);
    const response = {
      id: "/do/0/race/fork/branches/1/fast",
      outcome: elapsed,
    };

    const due = contextAfter(1000);

    const won = program.respond(state, response, due);

    expect(won).toMatchObject({
      status: "completed",
      withdrawn: ["/do/0/race/fork/branches/0/slow"],
    });
  });
  test("a faulted branch faults the fork and withdraws its sibling’s effect", () => {
    const program = programOf(brokenFork);
    const started = program.start({}, startContext);
    const state = restored(started.state);
    const response = {
      id: "/do/0/both/fork/branches/1/broken/do/0/pause",
      outcome: elapsed,
    };
    const due = contextAfter(1000);

    const faulted = program.respond(state, response, due);

    expect(faulted).toMatchObject({
      status: "faulted",
      error: { instance: "/do/0/both/fork/branches/1/broken/do/1/fail" },
      withdrawn: ["/do/0/both/fork/branches/0/slow"],
    });
  });

  test("cancel withdraws every branch’s effect and cancels the tasks innermost first", () => {
    const program = programOf(waitingFork);
    const started = program.start({}, startContext);
    const state = restored(started.state);
    const later = contextAfter(1000);

    const cancelled = program.cancel(state, later);

    expect(cancelled.withdrawn).toEqual([
      "/do/0/both/fork/branches/0/a",
      "/do/0/both/fork/branches/1/b",
    ]);
    expect(cancelled.events).toMatchObject([
      { name: "task.cancelled", execution: "/do/0/both/fork/branches/0/a" },
      { name: "task.cancelled", execution: "/do/0/both/fork/branches/1/b" },
      { name: "task.cancelled", execution: "/do/0/both" },
      { name: "workflow.cancelled" },
    ]);
  });

  test("a branch’s export changes the one context the tasks after the fork read", () => {
    const program = programOf(exportingFork);

    const started = program.start({}, startContext);

    expect(started).toMatchObject({
      status: "completed",
      output: { ctx: { leaked: true } },
    });
  });
});

describe("the state", () => {
  test("a state restored from its JSON text answers as the state itself", () => {
    const program = programOf(wait);
    const started = program.start({}, startContext);
    const restoredState = restored(started.state);
    const response = { id: "/do/0/pause", outcome: elapsed };
    const due = contextAfter(30000);

    const fromState = program.respond(started.state, response, due);
    const fromText = program.respond(restoredState, response, due);

    expect(fromText).toStrictEqual(fromState);
  });

  test("a state that is no object is refused as one with no format", () => {
    const program = programOf(wait);
    const missing = null as unknown as State;

    const resuming = () => program.resume(missing, startContext);

    expect(resuming).toThrow(
      expect.objectContaining({
        name: "InterpreterError",
        message: "The state holds no value at 'format'.",
      }),
    );
  });

  test("a state another program saved is refused", () => {
    const program = programOf(wait);
    const other = programOf(literal);
    const started = program.start({}, startContext);
    const state = restored(started.state);

    const resuming = () => other.resume(state, startContext);

    expect(resuming).toThrow(
      expect.objectContaining({
        name: "InterpreterError",
        message: expect.stringMatching(
          /^The state was saved under the fingerprint/,
        ) as string,
      }),
    );
  });

  test("a call on an ended run is refused", () => {
    const program = programOf(literal);
    const ended = program.start({}, startContext);
    const state = restored(ended.state);

    const resuming = () => program.resume(state, startContext);

    expect(resuming).toThrow(
      expect.objectContaining({
        name: "InterpreterError",
        message: "The run has ended completed: it takes no more calls.",
      }),
    );
  });
});

describe("frozen values", () => {
  test("a step’s output is frozen: a host write throws, and the next run gives it as written", () => {
    const program = programOf(literal);
    const first = program.start({}, startContext);

    if (first.status !== "completed") {
      throw new Error("The run did not complete.");
    }

    const items = (first.output as { items: number[] }).items;
    const writing = () => items.push(3);

    expect(writing).toThrow(TypeError);

    const second = program.start({}, startContext);

    expect(second).toMatchObject({
      status: "completed",
      output: { items: [1, 2] },
    });
  });
});
