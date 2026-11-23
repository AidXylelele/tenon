import type {
  EditAction,
  FailureKind,
  FormField,
  Step,
  StepFormResult,
} from "language-server/protocol";
import type {
  Commit,
  FailureChoice,
  FailureReading,
  FailureTarget,
  RetryCount,
  RetrySettings,
} from "./interfaces";
import { isObject, type Json } from "./json";

export const FIRST_RETRY: RetrySettings = {
  retries: 3,
  seconds: 2,
  growing: true,
};

export const FAILURE_CHOICES: readonly {
  readonly choice: FailureChoice;
  readonly label: string;
}[] = [
  { choice: "stop", label: "Stop the run" },
  { choice: "retryThenStop", label: "Retry, then stop" },
  { choice: "retryThenHandle", label: "Retry, then run other steps" },
  { choice: "continue", label: "Continue with the next step" },
  { choice: "handle", label: "Run other steps instead" },
];

const SECONDS_IN: ReadonlyMap<string, number> = new Map([
  ["days", 86_400],
  ["hours", 3600],
  ["minutes", 60],
  ["seconds", 1],
  ["milliseconds", 0.001],
]);

const LANE = "“If it fails” lane";

const REFUSED_COUNTS: Readonly<Record<RetryCount, string>> = {
  retries: "Write how many times as a whole number.",
  seconds: "Write the seconds as a whole number.",
};

export function failureOf(
  step: Step,
  form: StepFormResult,
  protection: StepFormResult | null,
): FailureReading {
  const source = protection ?? form;
  const handling = source.fields.find((field) => field.key === "catch");
  const retryField = handling?.fields.find((field) => field.key === "retry");
  const hasRetry = retryField?.written === true;
  const retry = hasRetry ? retrySettingsOf(retryField.value) : null;
  const choice = choiceOf(source.failure, hasRetry);
  const target = targetOf(step, protection, handling);

  return { choice, retry, target };
}

function choiceOf(kind: FailureKind, hasRetry: boolean): FailureChoice {
  switch (kind) {
    case "stop":
      return "stop";
    case "continue":
      return "continue";
    case "retry":
      return "retryThenStop";
    case "handle":
      return hasRetry ? "retryThenHandle" : "handle";
  }
}

function targetOf(
  step: Step,
  protection: StepFormResult | null,
  handling: FormField | undefined,
): FailureTarget {
  if (protection === null || handling === undefined)
    return { step: step.id, pointer: step.pointer };

  const end = handling.pointer.lastIndexOf("/");
  const pointer = handling.pointer.slice(0, end);
  return { step: protection.step, pointer };
}

function retrySettingsOf(policy: Json): RetrySettings | null {
  if (!isObject(policy)) return null;

  const seconds = secondsOf(policy.delay);
  const growing = growingOf(policy.backoff);
  const limit = policy.limit;
  const attempt = isObject(limit) ? limit.attempt : null;
  const count = isObject(attempt) ? attempt.count : null;
  const retries = typeof count === "number" ? count : null;

  if (seconds === null || growing === null || retries === null) return null;

  return { retries, seconds, growing };
}

function secondsOf(delay: Json | undefined): number | null {
  if (!isObject(delay)) return null;

  const amounts = Object.entries(delay).map(([unit, amount]) => {
    const scale = SECONDS_IN.get(unit) ?? Number.NaN;
    const counted = typeof amount === "number" ? amount : Number.NaN;
    return scale * counted;
  });
  const total = amounts.reduce((sum, each) => sum + each, 0);

  return Number.isFinite(total) ? total : null;
}

function growingOf(backoff: Json | undefined): boolean | null {
  if (backoff === undefined) return false;

  if (!isObject(backoff)) return null;

  if ("exponential" in backoff) return true;

  if ("constant" in backoff) return false;

  return null;
}

function policyOf(retry: RetrySettings): Json {
  const backoff = retry.growing ? "exponential" : "constant";
  return {
    delay: { seconds: retry.seconds },
    backoff: { [backoff]: {} },
    limit: { attempt: { count: retry.retries } },
  };
}

export function failureEditsOf(
  reading: FailureReading,
  chosen: FailureChoice,
  retry: RetrySettings,
): EditAction[] {
  const { step, pointer } = reading.target;
  const retryPointer = `${pointer}/catch/retry`;
  const lanePointer = `${pointer}/catch/do`;
  const retrying: EditAction = {
    kind: "setFailure",
    step,
    failure: { kind: "retry", ...retry },
  };
  const lane: EditAction = {
    kind: "setField",
    pointer: lanePointer,
    value: [],
  };

  if (chosen === reading.choice) return [];

  switch (chosen) {
    case "stop":
    case "continue":
      return [{ kind: "setFailure", step, failure: { kind: chosen } }];
    case "retryThenStop":
      return [retrying];
    case "handle":
      if (reading.choice === "retryThenHandle")
        return [{ kind: "clearField", pointer: retryPointer }];

      return [{ kind: "setFailure", step, failure: { kind: "handle" } }];
    case "retryThenHandle":
      return retryWithLaneOf(reading, retrying, lane, retry);
  }
}

function retryWithLaneOf(
  reading: FailureReading,
  retrying: EditAction,
  lane: EditAction,
  retry: RetrySettings,
): EditAction[] {
  const policy = policyOf(retry);
  const retryPointer = `${reading.target.pointer}/catch/retry`;

  if (reading.choice === "retryThenStop") return [lane];

  if (reading.choice === "handle")
    return [{ kind: "setField", pointer: retryPointer, value: policy }];

  return [retrying, lane];
}

export function retryChangeOf(
  reading: FailureReading,
  retry: RetrySettings,
): EditAction[] {
  const { step, pointer } = reading.target;
  const policy = policyOf(retry);
  const retryPointer = `${pointer}/catch/retry`;

  switch (reading.choice) {
    case "retryThenStop":
      return [
        { kind: "setFailure", step, failure: { kind: "retry", ...retry } },
      ];
    case "retryThenHandle":
      return [{ kind: "setField", pointer: retryPointer, value: policy }];
    case "stop":
    case "continue":
    case "handle":
      return [];
  }
}

export function retryCommitOf(
  reading: FailureReading,
  count: RetryCount,
  text: string,
): Commit {
  const shown = reading.retry ?? FIRST_RETRY;
  const trimmed = text.trim();
  const amount = Number(trimmed);
  const isCount = trimmed !== "" && Number.isInteger(amount) && amount >= 0;

  if (!isCount) return { kind: "refused", reason: REFUSED_COUNTS[count] };

  if (amount === shown[count]) return { kind: "edits", edits: [] };

  const next = { ...shown, [count]: amount };
  const edits = retryChangeOf(reading, next);
  return { kind: "edits", edits };
}

export function failureSummaryOf(reading: FailureReading): string {
  const retry = reading.retry;
  const times = retry === null ? "Retry" : `Retry ${String(retry.retries)}×`;

  switch (reading.choice) {
    case "stop":
      return "Stop the run";
    case "continue":
      return "Continue with the next step";
    case "handle":
      return `Run the steps in its ${LANE}`;
    case "retryThenHandle":
      return `${times}, then run the steps in its ${LANE}`;
    case "retryThenStop":
      return retryStopText(retry);
  }
}

function retryStopText(retry: RetrySettings | null): string {
  if (retry === null) return "Retry, then stop";

  const wait = retry.growing ? "growing" : "the same wait";
  const count = String(retry.retries);
  const seconds = String(retry.seconds);
  return `Retry ${count}×, ${seconds} s apart, ${wait}; then stop`;
}

export function failureNoteOf(choice: FailureChoice): string | null {
  switch (choice) {
    case "stop":
      return null;
    case "retryThenStop":
      return "The flow now draws this step inside a Try.";
    case "continue":
      return `The flow now draws this step inside a Try whose ${LANE} says the run continues with the next step.`;
    case "handle":
    case "retryThenHandle":
      return `The flow now draws this step inside a Try with an ${LANE} under it; press the lane's + to add the steps to run.`;
  }
}
