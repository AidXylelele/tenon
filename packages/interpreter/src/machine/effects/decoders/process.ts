import type {
  EffectOutcome,
  JsonValue,
  ProcessOutcome,
} from "../../../api/index.js";
import type { ProcessDecoder } from "../../../core/index.js";
import { Raised } from "../../../runtime/index.js";
import type { ReturnMode } from "../../../standard/index.js";
import type { Decoded } from "./decoders.js";
import { failureErrorOf, isHostFailure } from "./failures.js";
import { checkTaken, processKinds } from "./kinds.js";

type Exit = Extract<ProcessOutcome, { readonly kind: "exited" }>;

type Unrun = Extract<ProcessOutcome, { readonly kind: "unstarted" | "killed" }>;

const success = 0;

export function processDecodedOf(
  decoding: ProcessDecoder,
  outcome: EffectOutcome,
): Decoded {
  checkTaken(processKinds, outcome, decoding);

  const failed = isHostFailure(outcome);

  if (failed) {
    throw failureErrorOf(outcome);
  }

  switch (outcome.kind) {
    case "exited": {
      const value = exitValueOf(outcome, decoding.return);
      return { value, authorization: null };
    }
    case "unstarted":
    case "killed":
      throw unrunOf(outcome);
  }
}

export function unrunOf(outcome: Unrun): Raised {
  return Raised.standard("runtime", outcome.detail);
}

function exitValueOf(exit: Exit, mode: ReturnMode): JsonValue {
  const kept = keepsCode(mode);
  const failed = exit.code !== success && !kept;

  if (failed) {
    throw exitErrorOf(exit);
  }

  switch (mode) {
    case "stdout":
      return exit.stdout;
    case "stderr":
      return exit.stderr;
    case "code":
      return exit.code;
    case "all":
      return { code: exit.code, stdout: exit.stdout, stderr: exit.stderr };
    case "none":
      return null;
  }
}

function keepsCode(mode: ReturnMode): boolean {
  switch (mode) {
    case "code":
    case "all":
      return true;
    case "stdout":
    case "stderr":
    case "none":
      return false;
  }
}

function exitErrorOf(exit: Exit): Raised {
  const silent = exit.stderr === "";

  if (!silent) {
    return Raised.standard("runtime", exit.stderr);
  }

  const code = String(exit.code);
  const detail = `The process exited with code ${code}.`;
  return Raised.standard("runtime", detail);
}
