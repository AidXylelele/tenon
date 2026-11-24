import { readdirSync, readFileSync } from "node:fs";
import {
  AstBuilder,
  GherkinClassicTokenMatcher,
  Parser,
  compile,
} from "@cucumber/gherkin";
import { IdGenerator, type Pickle } from "@cucumber/messages";
import { expect, test } from "vitest";
import { parse } from "yaml";
import workflowSchema from "../../src/syntax/grammar/workflow-schema.json" with { type: "json" };
import type {
  EffectOutcome,
  JsonValue,
  LifecycleEvent,
  Program,
  Step,
} from "../../src/index.js";
import { isJsonObject } from "../../src/runtime/index.js";
import { programOf, restored, startContext } from "../support/interpreter.js";

type Outcomes = Readonly<
  Record<string, Readonly<Record<string, readonly EffectOutcome[]>>>
>;

interface Conformance {
  readonly feature: string;
  readonly pickle: Pickle;
}

interface Played {
  readonly step: Step;
  readonly events: readonly LifecycleEvent[];
}

interface Check {
  readonly pattern: RegExp;
  readonly check: (
    played: Played,
    match: RegExpExecArray,
    text: string,
  ) => void;
}

const features = `${import.meta.dirname}/../../spec/1.1.0/ctk/features`;

const outcomesText = readFileSync(
  `${import.meta.dirname}/outcomes.yaml`,
  "utf8",
);

const outcomes = parse(outcomesText) as Outcomes;

const definition = /^a workflow with definition:$/;

const givenInput = /^given the workflow input is:$/;

const executed = /^the workflow is executed$/;

const arranging = [definition, givenInput, executed];

const checks: readonly Check[] = [
  {
    pattern: /^the workflow should complete$/,
    check: ({ step }) => {
      expect(step.status).toBe("completed");
    },
  },
  {
    pattern: /^the workflow should fault$/,
    check: ({ step }) => {
      expect(step.status).toBe("faulted");
    },
  },
  {
    pattern: /^the workflow should complete with output:$/,
    check: ({ step }, _match, text) => {
      const output: unknown = parse(text);

      expect(step.status).toBe("completed");
      expect(step).toHaveProperty("output", output);
    },
  },
  {
    pattern: /^the workflow should fault with error:$/,
    check: ({ step }, _match, text) => {
      const error: unknown = parse(text);

      expect(step).toMatchObject({ status: "faulted", error });
    },
  },
  {
    pattern: /^the workflow output should have properties (.+)$/,
    check: ({ step }, match) => {
      const listed = groupOf(match, 1);
      const quoted = [...listed.matchAll(/'([^']+)'/g)];
      const paths = quoted.map((property) => groupOf(property, 1));
      const read = paths.map((path) => valueAt(step, path));

      expect(read).not.toContain(undefined);
    },
  },
  {
    pattern:
      /^the workflow output should have a '([^']+)' property with value:$/,
    check: ({ step }, match, text) => {
      const path = groupOf(match, 1);
      const value = valueAt(step, path);
      const expected: unknown = parse(text);

      expect(value).toEqual(expected);
    },
  },
  {
    pattern:
      /^the workflow output should have a '([^']+)' property containing (\d+) items$/,
    check: ({ step }, match) => {
      const path = groupOf(match, 1);
      const value = valueAt(step, path);
      const count = Number(groupOf(match, 2));

      expect(value).toHaveLength(count);
    },
  },
  {
    pattern: /^(\w+) should run first$/,
    check: ({ events }, match) => {
      const task = groupOf(match, 1);
      const started = startedOf(events);

      expect(started.at(0)).toBe(task);
    },
  },
  {
    pattern: /^(\w+) should run last$/,
    check: ({ events }, match) => {
      const task = groupOf(match, 1);
      const started = startedOf(events);

      expect(started.at(-1)).toBe(task);
    },
  },
  {
    pattern: /^(\w+) should run after (\w+)$/,
    check: ({ events }, match) => {
      const started = startedOf(events);
      const laterTask = groupOf(match, 1);
      const earlierTask = groupOf(match, 2);
      const later = started.indexOf(laterTask);
      const earlier = started.indexOf(earlierTask);

      expect(earlier).not.toBe(-1);
      expect(later).toBeGreaterThan(earlier);
    },
  },
];

function picklesOf(feature: string): readonly Pickle[] {
  const text = readFileSync(`${features}/${feature}.feature`, "utf8");
  const newId = IdGenerator.incrementing();
  const builder = new AstBuilder(newId);
  const parser = new Parser(builder, new GherkinClassicTokenMatcher());
  const document = parser.parse(text);

  return compile(document, `${feature}.feature`, newId);
}

function conformancesOf(file: string): readonly Conformance[] {
  const feature = file.slice(0, -".feature".length);
  const pickles = picklesOf(feature);

  return pickles.map((pickle) => ({ feature, pickle }));
}

function docStringOf(pickle: Pickle, pattern: RegExp): string | undefined {
  const step = pickle.steps.find((candidate) => pattern.test(candidate.text));

  return step?.argument?.docString?.content;
}

function answeredOf(
  program: Program,
  played: Played,
  outcome: EffectOutcome,
): Played {
  const [effect] = played.step.requested;

  if (effect === undefined) {
    throw new Error(`The run awaits no effect to answer ${outcome.kind}.`);
  }

  const state = restored(played.step.state);
  const response = { id: effect.id, outcome };
  const step = program.respond(state, response, startContext);
  const events = [...played.events, ...step.events];

  return { step, events };
}

function playedOf({ feature, pickle }: Conformance): Played {
  const document = docStringOf(pickle, definition);
  const inputText = docStringOf(pickle, givenInput) ?? "{}";
  const input = parse(inputText) as JsonValue;
  const answers = outcomes[feature]?.[pickle.name] ?? [];

  if (document === undefined) {
    throw new Error(`The scenario "${pickle.name}" defines no workflow.`);
  }

  const program = programOf(document);
  const step = program.start(input, startContext);
  const started: Played = { step, events: step.events };

  return answers.reduce(
    (played, outcome) => answeredOf(program, played, outcome),
    started,
  );
}

function groupOf(match: RegExpMatchArray, index: number): string {
  const group = match[index];

  if (group === undefined) {
    throw new Error(`The step's pattern captured no group ${String(index)}.`);
  }

  return group;
}

function memberOf(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  return Reflect.get(value, name);
}

function valueAt(step: Step, path: string): unknown {
  if (step.status !== "completed") {
    const shown = JSON.stringify(step);
    throw new Error(`The run did not complete: ${shown}`);
  }

  const names = path.split(".");

  return names.reduce<unknown>(memberOf, step.output);
}

function taskNameOf(event: LifecycleEvent): string {
  const reference = event.data.task;

  if (typeof reference !== "string") {
    throw new Error(`The event ${event.name} names no task.`);
  }

  const slash = reference.lastIndexOf("/");
  const token = reference.slice(slash + 1);

  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

function startedOf(events: readonly LifecycleEvent[]): readonly string[] {
  const started = events.filter((event) => event.name === "task.started");

  return started.map(taskNameOf);
}

function checkStep(played: Played, text: string, content: string): void {
  const found = checks.find(({ pattern }) => pattern.test(text));
  const match = found?.pattern.exec(text) ?? null;

  if (found === undefined || match === null) {
    throw new Error(`No check reads the step "${text}".`);
  }

  found.check(played, match, content);
}

const scenarios = readdirSync(features)
  .filter((file) => file.endsWith(".feature"))
  .toSorted((left, right) => left.localeCompare(right))
  .flatMap(conformancesOf)
  .map((each): [string, Conformance] => [
    `${each.feature}: ${each.pickle.name}`,
    each,
  ]);

test.each(scenarios)("%s", (_title, scenario) => {
  const played = playedOf(scenario);
  const outcomeSteps = scenario.pickle.steps.filter(
    (step) => !arranging.some((pattern) => pattern.test(step.text)),
  );

  for (const step of outcomeSteps) {
    const content = step.argument?.docString?.content ?? "";
    checkStep(played, step.text, content);
  }
});

test("the grammar is the standard's schema less the two task references its check levels", () => {
  const vendored = `${import.meta.dirname}/../../spec/1.1.0/schema/workflow.yaml`;
  const text = readFileSync(vendored, "utf8");
  const standard = parse(text) as JsonValue;
  const functions = ["properties", "use", "properties", "functions"];
  const listed = ["$defs", "taskList", "items"];
  const unlevelled = withAt(standard, functions, unreferenced);
  const levelled = withAt(unlevelled, listed, unreferenced);

  expect(workflowSchema).toEqual(levelled);
});

function unreferenced(node: JsonValue): JsonValue {
  return withAt(node, ["additionalProperties"], () => ({}));
}

function withAt(
  value: JsonValue,
  tokens: readonly string[],
  replace: (node: JsonValue) => JsonValue,
): JsonValue {
  const [token, ...rest] = tokens;

  if (token === undefined) {
    return replace(value);
  }

  const isObject = isJsonObject(value);

  if (!isObject) {
    throw new Error(`The schema holds no object at '${token}'.`);
  }

  const child = value[token] ?? null;
  const replaced = withAt(child, rest, replace);

  return { ...value, [token]: replaced };
}
