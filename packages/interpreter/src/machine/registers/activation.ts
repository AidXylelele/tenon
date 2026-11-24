import type { JsonValue } from "../../api/index.js";
import type { Descriptor } from "../../core/index.js";
import type { StatusPhase } from "../../standard/index.js";
import type { Path } from "../identity/index.js";

export type Address = number;

export interface Activation {
  readonly descriptor: Descriptor;
  readonly enclosing: Address;
  readonly path: Path;
  readonly startedAt: number;
  readonly input: JsonValue;
  readonly output: JsonValue;
  readonly authorization: JsonValue;
  readonly phase: StatusPhase;
}

type ActivationParts = Pick<
  Activation,
  "descriptor" | "enclosing" | "path" | "startedAt"
>;

export function activationOf(parts: ActivationParts): Activation {
  return {
    descriptor: parts.descriptor,
    enclosing: parts.enclosing,
    path: parts.path,
    startedAt: parts.startedAt,
    input: null,
    output: null,
    authorization: null,
    phase: "pending",
  };
}

export function isWorkflowCell(cell: Activation, address: Address): boolean {
  return cell.enclosing === address;
}

export function withInput(
  activation: Activation,
  input: JsonValue,
): Activation {
  return {
    descriptor: activation.descriptor,
    enclosing: activation.enclosing,
    path: activation.path,
    startedAt: activation.startedAt,
    input,
    output: activation.output,
    authorization: activation.authorization,
    phase: activation.phase,
  };
}

export function withOutput(
  activation: Activation,
  output: JsonValue,
): Activation {
  return {
    descriptor: activation.descriptor,
    enclosing: activation.enclosing,
    path: activation.path,
    startedAt: activation.startedAt,
    input: activation.input,
    output,
    authorization: activation.authorization,
    phase: activation.phase,
  };
}

export function withAuthorization(
  activation: Activation,
  authorization: JsonValue,
): Activation {
  return {
    descriptor: activation.descriptor,
    enclosing: activation.enclosing,
    path: activation.path,
    startedAt: activation.startedAt,
    input: activation.input,
    output: activation.output,
    authorization,
    phase: activation.phase,
  };
}

export function withPhase(
  activation: Activation,
  phase: StatusPhase,
): Activation {
  return {
    descriptor: activation.descriptor,
    enclosing: activation.enclosing,
    path: activation.path,
    startedAt: activation.startedAt,
    input: activation.input,
    output: activation.output,
    authorization: activation.authorization,
    phase,
  };
}
