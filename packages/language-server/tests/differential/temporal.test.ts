import { readdirSync, readFileSync } from "node:fs";
import type { JsonValue, Occurrence } from "interpreter/front-end";
import { Temporal as polyfilled } from "temporal-polyfill/implementation";
import { expect, onTestFinished, test } from "vitest";
import { analyzer, profile } from "../support/analyzer.js";

const created = await analyzer;

const frontEndUrl = import.meta.resolve("interpreter/front-end");
const examplesUrl = new URL("../spec/1.1.0/examples/", frontEndUrl);
const exampleNames = readdirSync(examplesUrl).filter((name) =>
  name.endsWith(".yaml"),
);

const durationForms: readonly (readonly [string, JsonValue])[] = [
  ["seconds", "PT1S"],
  ["minutes", "PT1M"],
  ["hours", "PT1H"],
  ["days", "P1D"],
  ["every unit of a day", "P1DT1H1M1S"],
  ["a fraction of a second", "PT1.5S"],
  ["a microsecond", "PT0.000001S"],
  ["a fraction before the last unit", "PT1.5H30M"],
  ["a fraction of a day", "P1.5D"],
  ["a year", "P1Y"],
  ["a month", "P1M"],
  ["a week", "P1W"],
  ["zero", "PT0S"],
  ["days past the range", "P1000000000000D"],
  ["an object of days", { days: 1 }],
  ["an object of hours", { hours: 1 }],
  ["an object of minutes", { minutes: 1 }],
  ["an object of seconds", { seconds: 1 }],
  ["an object of milliseconds", { milliseconds: 1 }],
  [
    "an object of every field",
    { days: 1, hours: 1, minutes: 1, seconds: 1, milliseconds: 1 },
  ],
  ["a negative field", { seconds: -1 }],
  ["fields of mixed signs", { hours: 1, minutes: -1 }],
];

interface DurationVerdict {
  readonly pointer: string;
  readonly kind: string;
  readonly milliseconds: number | null;
}

function verdictOf(text: string) {
  const options = { profile, imports: {} };
  const analysis = created.analyze(text, options);
  const diagnostics = analysis.diagnostics.map(({ code, pointer }) => ({
    code,
    pointer,
  }));
  const occurrences =
    analysis.kind === "analyzed" ? analysis.model.occurrences : [];
  const durations = occurrences.flatMap(durationVerdictOf);

  return { diagnostics, durations };
}

function durationVerdictOf(occurrence: Occurrence): readonly DurationVerdict[] {
  if (occurrence.kind !== "duration") {
    return [];
  }

  const duration = occurrence.duration;
  const isExact =
    duration.kind === "fixed" && Number.isSafeInteger(duration.milliseconds);
  const milliseconds = isExact ? duration.milliseconds : null;

  return [{ pointer: duration.pointer, kind: duration.kind, milliseconds }];
}

function polyfilledVerdictOf(text: string) {
  const native = Object.getOwnPropertyDescriptor(globalThis, "Temporal");
  Object.defineProperty(globalThis, "Temporal", {
    value: polyfilled,
    configurable: true,
    writable: true,
  });
  onTestFinished(() => {
    Reflect.deleteProperty(globalThis, "Temporal");
    Object.defineProperty(globalThis, "Temporal", native ?? {});
  });

  return verdictOf(text);
}

function waitingOn(form: JsonValue): string {
  const written = JSON.stringify(form);

  return `document: { dsl: '1.1.0', namespace: test, name: wait, version: '0.1.0' }
do:
  - pause:
      wait: ${written}
`;
}

test.each(exampleNames)(
  "the example %s reads the same under the polyfill",
  (name) => {
    const exampleUrl = new URL(name, examplesUrl);
    const text = readFileSync(exampleUrl, "utf8");
    const native = verdictOf(text);

    const underPolyfill = polyfilledVerdictOf(text);

    expect(underPolyfill).toEqual(native);
  },
);

test.each(durationForms)(
  "a wait of %s reads the same under the polyfill",
  (_, form) => {
    const text = waitingOn(form);
    const native = verdictOf(text);

    const underPolyfill = polyfilledVerdictOf(text);

    expect(underPolyfill).toEqual(native);
  },
);
