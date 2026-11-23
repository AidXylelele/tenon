import type {
  EditAction,
  FailureKind,
  FormField,
  RetriedErrors,
  RetryOn,
  RetryPlan,
  RetrySetting,
  Step,
  StepFormResult,
} from "language-server/protocol";
import type {
  Commit,
  FailureChoice,
  FailureReading,
  FailureTarget,
  RetryCount,
} from "./interfaces";

export const FIRST_RETRY: RetrySetting = {
  retries: 3,
  milliseconds: 2000,
  backoff: "exponential",
  on: { kind: "any" },
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

const LANE = "“If it fails” lane";

const SECOND = 1000;

const REFUSED_STATUSES =
  "Write the statuses as numbers from 100 to 599, such as 503, 429.";

const WAITS: Readonly<Record<RetrySetting["backoff"], string>> = {
  exponential: "growing",
  linear: "growing evenly",
  constant: "the same wait",
};

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
  const plan = source.retry;
  const retry = plan === null ? null : settingOf(plan);
  const isWrittenOtherwise = plan !== null && plan.milliseconds === null;
  const choice = choiceOf(source.failure, plan !== null);
  const target = targetOf(step, protection, handling);

  return { choice, retry, isWrittenOtherwise, target };
}

function settingOf(plan: RetryPlan): RetrySetting {
  const milliseconds = plan.milliseconds ?? FIRST_RETRY.milliseconds;

  return {
    retries: plan.retries,
    milliseconds,
    backoff: plan.backoff,
    on: plan.on,
  };
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

export function failureEditsOf(
  reading: FailureReading,
  chosen: FailureChoice,
  retry: RetrySetting,
): EditAction[] {
  const { step, pointer } = reading.target;
  const retryPointer = `${pointer}/catch/retry`;

  if (chosen === reading.choice) return [];

  switch (chosen) {
    case "stop":
    case "continue":
      return [{ kind: "setFailure", step, failure: { kind: chosen } }];
    case "retryThenStop":
      return [{ kind: "setFailure", step, failure: { kind: "retry", retry } }];
    case "retryThenHandle":
      return [{ kind: "setFailure", step, failure: { kind: "handle", retry } }];
    case "handle":
      if (reading.choice === "retryThenHandle")
        return [{ kind: "clearField", pointer: retryPointer }];

      return [{ kind: "setFailure", step, failure: { kind: "handle" } }];
  }
}

export function retryChangeOf(
  reading: FailureReading,
  retry: RetrySetting,
): EditAction[] {
  const { step } = reading.target;

  switch (reading.choice) {
    case "retryThenStop":
      return [{ kind: "setFailure", step, failure: { kind: "retry", retry } }];
    case "retryThenHandle":
      return [{ kind: "setFailure", step, failure: { kind: "handle", retry } }];
    case "stop":
    case "continue":
    case "handle":
      return [];
  }
}

export function retryCountsOf(retry: RetrySetting): Record<RetryCount, string> {
  const retries = retry.retries === null ? "" : String(retry.retries);
  const seconds = String(retry.milliseconds / SECOND);

  return { retries, seconds };
}

export function retryCommitOf(
  reading: FailureReading,
  count: RetryCount,
  text: string,
): Commit {
  const shown = reading.retry ?? FIRST_RETRY;
  const counts = retryCountsOf(shown);
  const trimmed = text.trim();
  const amount = Number(trimmed);
  const isCount = trimmed !== "" && Number.isInteger(amount) && amount >= 0;

  if (trimmed === counts[count]) return { kind: "edits", edits: [] };

  if (!isCount) return { kind: "refused", reason: REFUSED_COUNTS[count] };

  const next =
    count === "retries"
      ? { ...shown, retries: amount }
      : { ...shown, milliseconds: amount * SECOND };
  const edits = retryChangeOf(reading, next);
  return { kind: "edits", edits };
}

export const BACKOFF_CHOICES: readonly {
  readonly backoff: RetrySetting["backoff"];
  readonly label: string;
}[] = [
  { backoff: "exponential", label: "grows: doubling each time" },
  { backoff: "linear", label: "grows by the same step each time" },
  { backoff: "constant", label: "stays the same" },
];

export const RETRY_WHEN_CHOICES: readonly {
  readonly on: RetriedErrors["kind"];
  readonly label: string;
}[] = [
  { on: "any", label: "Any error" },
  { on: "timeouts", label: "It runs out of time" },
  { on: "statuses", label: "The answer has one of these statuses" },
];

export function statusesText(on: RetryOn): string {
  if (on.kind !== "statuses") return "";

  return on.statuses.join(", ");
}

export function retryWhenCommitOf(
  reading: FailureReading,
  chosen: RetriedErrors["kind"],
  statuses: string,
): Commit {
  const shown = reading.retry ?? FIRST_RETRY;
  const on = retriedOf(chosen, statuses);

  if (on === null) return { kind: "refused", reason: REFUSED_STATUSES };

  const before = JSON.stringify(shown.on);
  const after = JSON.stringify(on);

  if (before === after) return { kind: "edits", edits: [] };

  const next = { ...shown, on };
  const edits = retryChangeOf(reading, next);
  return { kind: "edits", edits };
}

function retriedOf(
  chosen: RetriedErrors["kind"],
  text: string,
): RetriedErrors | null {
  switch (chosen) {
    case "any":
      return { kind: "any" };
    case "timeouts":
      return { kind: "timeouts" };
    case "statuses":
      return statusesOf(text);
  }
}

function statusesOf(text: string): RetriedErrors | null {
  const parts = text.split(",").map((part) => part.trim());
  const statuses = parts.map(Number);
  const isList = parts.every((part) => part !== "") && statuses.every(isStatus);

  return isList ? { kind: "statuses", statuses } : null;
}

function isStatus(status: number): boolean {
  return Number.isInteger(status) && status >= 100 && status <= 599;
}

export function failureSummaryOf(reading: FailureReading): string {
  const retry = reading.retry;
  const count = retry?.retries ?? null;
  const times = count === null ? "Retry" : `Retry ${String(count)}×`;

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
      return retryStopText(retry, times);
  }
}

function retryStopText(retry: RetrySetting | null, times: string): string {
  if (retry === null) return "Retry, then stop";

  const wait = WAITS[retry.backoff];
  const seconds = String(retry.milliseconds / SECOND);
  return `${times}, ${seconds} s apart, ${wait}; then stop`;
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
