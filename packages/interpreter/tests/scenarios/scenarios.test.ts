import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parse } from "yaml";
import type { Imports } from "../../src/api/index.js";
import type {
  Effect,
  EffectOutcome,
  HostProfile,
  JsonObject,
  JsonValue,
  LifecycleEvent,
  Program,
  StartContext,
  Step,
} from "../../src/index.js";
import {
  fullProfile,
  programOf,
  restored,
  startContext,
} from "../support/interpreter.js";

interface ScriptedStep {
  readonly effect: JsonObject;
  readonly now: number;
  readonly outcome?: EffectOutcome;
  readonly cancel?: true;
}

interface Start {
  readonly instanceId?: string;
  readonly now?: number;
  readonly runtime?: StartContext["runtime"];
  readonly secrets?: JsonObject;
}

interface End {
  readonly completed?: { readonly output: JsonValue };
  readonly faulted?: { readonly error: JsonObject };
  readonly waiting?: { readonly effect: JsonObject };
  readonly cancelled?: JsonObject;
}

interface Facts {
  readonly exactly?: readonly JsonObject[];
  readonly including?: readonly JsonObject[];
}

interface Scenario {
  readonly document: string;
  readonly profile?: Partial<HostProfile>;
  readonly imports?: Imports;
  readonly input?: JsonValue;
  readonly correlate?: true;
  readonly start?: Start;
  readonly script?: readonly ScriptedStep[];
  readonly end: End;
  readonly facts: Facts;
  readonly hidden?: readonly string[];
}

interface Run {
  readonly program: Program;
  readonly context: StartContext;
}

interface Played {
  readonly steps: readonly Step[];
  readonly last: Step;
  readonly awaited: readonly Effect[];
}

const folder = import.meta.dirname;

const names = readdirSync(folder, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".yaml"))
  .map((file) => file.slice(0, -".yaml".length))
  .toSorted((left, right) => left.localeCompare(right));

function scenarioOf(name: string): Scenario {
  const text = readFileSync(`${folder}/${name}.yaml`, "utf8");

  return parse(text) as Scenario;
}

function runOf(scenario: Scenario): Run {
  const profile = { ...fullProfile, ...scenario.profile };
  const imports = scenario.imports ?? {};
  const program = programOf(scenario.document, { profile, imports });
  const start = scenario.start ?? {};
  const context: StartContext = {
    ...startContext,
    instance: start.instanceId ?? startContext.instance,
    now: start.now ?? startContext.now,
    runtime: start.runtime ?? startContext.runtime,
    secrets: start.secrets ?? startContext.secrets,
  };

  return { program, context };
}

function firstStepOf(run: Run, scenario: Scenario): Step {
  if (scenario.correlate === true) {
    return run.program.correlate(run.context);
  }

  const input = scenario.input ?? null;

  return run.program.start(input, run.context);
}

function openedOf(run: Run, scenario: Scenario): Played {
  const step = firstStepOf(run, scenario);

  return { steps: [step], last: step, awaited: step.requested };
}

function onlyAwaitedOf(played: Played): Effect {
  expect(played.last.status).toBe("running");
  expect(played.awaited).toHaveLength(1);

  const [effect] = played.awaited;

  if (effect === undefined) {
    throw new Error("The run awaits no effect.");
  }

  return effect;
}

function stillAwaitedOf(effect: Effect, step: Step): readonly Effect[] {
  const isDeclined = step.declined.length > 0;
  const isWithdrawn = step.withdrawn.includes(effect.id);

  if (isDeclined && !isWithdrawn) {
    return [effect];
  }

  return [];
}

function nextOf(run: Run, played: Played, scripted: ScriptedStep): Played {
  const effect = onlyAwaitedOf(played);
  const state = restored(played.last.state);
  const context = { ...run.context, now: scripted.now };

  expectMatching(effect, scripted.effect);

  if (scripted.cancel === true) {
    const step = run.program.cancel(state, context);
    return { steps: [...played.steps, step], last: step, awaited: [] };
  }

  if (scripted.outcome === undefined) {
    throw new Error("A scripted step answers with an outcome or cancels.");
  }

  const response = { id: effect.id, outcome: scripted.outcome };
  const step = run.program.respond(state, response, context);
  const still = stillAwaitedOf(effect, step);
  const awaited = [...still, ...step.requested];

  return { steps: [...played.steps, step], last: step, awaited };
}

function playedOf(scenario: Scenario): Played {
  const run = runOf(scenario);
  const opened = openedOf(run, scenario);
  const script = scenario.script ?? [];

  return script.reduce(
    (played, scripted) => nextOf(run, played, scripted),
    opened,
  );
}

function expectEnd(played: Played, end: End): void {
  const step = played.last;

  if (end.completed !== undefined) {
    const output = end.completed.output;
    expectMatching(step, { status: "completed", output });
    return;
  }

  if (end.faulted !== undefined) {
    const error = end.faulted.error;
    expectMatching(step, { status: "faulted", error });
    return;
  }

  if (end.cancelled !== undefined) {
    expect(step.status).toBe("cancelled");
    return;
  }

  if (end.waiting === undefined) {
    throw new Error(
      "A scenario ends completed, faulted, cancelled or waiting.",
    );
  }

  const effect = onlyAwaitedOf(played);

  expectMatching(effect, end.waiting.effect);
}

function factOf(event: LifecycleEvent): JsonObject {
  switch (event.subject) {
    case "workflow":
      return { kind: event.name, ...event.data };
    case "task":
      return { kind: event.name, ...event.data, execution: event.execution };
  }
}

function matches(actual: unknown, stated: unknown): boolean {
  if (stated === null) {
    return actual === null || actual === undefined;
  }

  if (Array.isArray(stated)) {
    return (
      Array.isArray(actual) &&
      actual.length === stated.length &&
      stated.every((item, index) => matches(actual[index], item))
    );
  }

  if (typeof stated === "object") {
    const isObject = typeof actual === "object" && actual !== null;
    const entries = Object.entries(stated);

    return (
      isObject &&
      entries.every(([key, value]) => matches(Reflect.get(actual, key), value))
    );
  }

  return Object.is(actual, stated);
}

function expectMatching(actual: unknown, stated: unknown): void {
  const isMatching = matches(actual, stated);
  const shown = JSON.stringify({ actual, stated }, null, 2);

  expect(isMatching, shown).toBe(true);
}

function foundInOrder(
  reported: readonly JsonObject[],
  wanted: readonly JsonObject[],
): readonly JsonObject[] {
  const found = reported.reduce((count, fact) => {
    const next = wanted[count];
    const isNext = next !== undefined && matches(fact, next);
    return isNext ? count + 1 : count;
  }, 0);

  return wanted.slice(0, found);
}

function expectFacts(reported: readonly JsonObject[], facts: Facts): void {
  if (facts.exactly !== undefined) {
    expectMatching(reported, facts.exactly);
    return;
  }

  const wanted = facts.including ?? [];
  const found = foundInOrder(reported, wanted);
  const shown = JSON.stringify(reported, null, 2);

  expect(found, shown).toEqual(wanted);
}

function expectNothingHidden(
  hidden: readonly string[],
  steps: readonly Step[],
): void {
  const texts = steps.flatMap((step) => [
    JSON.stringify(step.state),
    JSON.stringify(step.requested),
  ]);
  const leaked = hidden.filter((secret) => {
    const written = JSON.stringify(secret).slice(1, -1);
    return texts.some((text) => text.includes(written));
  });

  expect(leaked).toEqual([]);
}

test.each(names)("%s", (name) => {
  const scenario = scenarioOf(name);
  const played = playedOf(scenario);
  const events = played.steps.flatMap((step) => step.events);
  const reported = events.map(factOf);
  const hidden = scenario.hidden ?? [];

  expectEnd(played, scenario.end);
  expectFacts(reported, scenario.facts);
  expectNothingHidden(hidden, played.steps);
});
