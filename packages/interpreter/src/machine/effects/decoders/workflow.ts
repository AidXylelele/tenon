import type {
  EffectOutcome,
  JsonValue,
  WorkflowError,
} from "../../../api/index.js";
import type { WorkflowDecoder } from "../../../core/index.js";
import { Raised } from "../../../runtime/index.js";
import {
  type ReturnMode,
  errorProperties,
  instanceProperty,
} from "../../../standard/index.js";
import type { Decoded } from "./decoders.js";
import { checkTaken, workflowKinds } from "./kinds.js";

type ErrorEntry = readonly [string, JsonValue];

const problemProperties = errorProperties.filter(
  (property) => property !== instanceProperty,
);

const notFound = 404;

export function workflowDecodedOf(
  decoding: WorkflowDecoder,
  outcome: EffectOutcome,
): Decoded {
  checkTaken(workflowKinds, outcome, decoding);

  switch (outcome.kind) {
    case "completed": {
      const value = childOutputOf(outcome.output, decoding.return);
      return { value, authorization: null };
    }
    case "faulted":
      throw childErrorOf(outcome.error);
    case "cancelled":
      throw Raised.standard("runtime", "The workflow it ran was cancelled.");
    case "missing":
      throw missingOf();
  }
}

export function missingOf(): Raised {
  return Raised.withStatus({
    name: "configuration",
    detail: "The workflow to run is not published.",
    status: notFound,
  });
}

function childOutputOf(output: JsonValue, mode: ReturnMode): JsonValue {
  switch (mode) {
    case "none":
      return null;
    case "stdout":
    case "stderr":
    case "code":
    case "all":
      return output;
  }
}

function childErrorOf(error: WorkflowError): Raised {
  const entries = problemProperties.flatMap((property) =>
    ownEntryOf(error, property),
  );
  const problem = Object.fromEntries(entries);

  return Raised.answered(problem);
}

function ownEntryOf(
  error: WorkflowError,
  property: string,
): readonly ErrorEntry[] {
  const value = error[property];

  if (value === undefined) {
    return [];
  }

  return [[property, value]];
}
