import type { EffectOutcome, JsonValue } from "../../../api/index.js";
import type { InputDecoder } from "../../../core/index.js";
import type { Decoded } from "./decoders.js";
import { failureErrorOf, isHostFailure } from "./failures.js";
import {
  checkTaken,
  processStartKinds,
  timerKinds,
  workflowStartKinds,
} from "./kinds.js";
import { unrunOf } from "./process.js";
import { missingOf } from "./workflow.js";

export function inputDecodedOf(
  decoding: InputDecoder,
  outcome: EffectOutcome,
  carried: JsonValue,
): Decoded {
  switch (decoding.awaits) {
    case "timer":
      return elapsedInputOf(decoding, outcome, carried);
    case "process":
      return startedProcessOf(decoding, outcome, carried);
    case "workflow":
      return startedWorkflowOf(decoding, outcome, carried);
  }
}

function elapsedInputOf(
  decoding: InputDecoder,
  outcome: EffectOutcome,
  carried: JsonValue,
): Decoded {
  checkTaken(timerKinds, outcome, decoding);

  return { value: carried, authorization: null };
}

function startedProcessOf(
  decoding: InputDecoder,
  outcome: EffectOutcome,
  carried: JsonValue,
): Decoded {
  checkTaken(processStartKinds, outcome, decoding);

  const failed = isHostFailure(outcome);

  if (failed) {
    throw failureErrorOf(outcome);
  }

  switch (outcome.kind) {
    case "started":
      return { value: carried, authorization: null };
    case "unstarted":
      throw unrunOf(outcome);
  }
}

function startedWorkflowOf(
  decoding: InputDecoder,
  outcome: EffectOutcome,
  carried: JsonValue,
): Decoded {
  checkTaken(workflowStartKinds, outcome, decoding);

  switch (outcome.kind) {
    case "started":
      return { value: carried, authorization: null };
    case "missing":
      throw missingOf();
  }
}
