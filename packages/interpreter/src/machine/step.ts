import type { JsonObject, Step, WorkflowError } from "../api/index.js";
import { InterpreterError } from "../runtime/index.js";
import type { MachineOutcome } from "./machine.js";
import { type Seal, encodeState } from "./state/index.js";

type StepCommon = Omit<Extract<Step, { readonly status: "running" }>, "status">;

export function stepOf(outcome: MachineOutcome, seal: Seal): Step {
  const snapshot = outcome.snapshot;
  const state = encodeState(snapshot, seal);
  const common: StepCommon = {
    state,
    requested: outcome.requested,
    withdrawn: outcome.withdrawn,
    declined: outcome.declined,
    events: outcome.events,
    taskInputs: outcome.taskInputs,
    taskOutputs: outcome.taskOutputs,
  };
  const result = snapshot.result;

  switch (result.kind) {
    case "running":
      return runningOf(snapshot.status, common);
    case "completed":
      return { status: result.kind, output: result.output, ...common };
    case "faulted": {
      const error = workflowErrorOf(result.error);
      return { status: result.kind, error, ...common };
    }
    case "cancelled":
      return { status: result.kind, ...common };
  }
}

function runningOf(status: Step["status"], common: StepCommon): Step {
  switch (status) {
    case "running":
    case "suspended":
      return { status, ...common };
    case "completed":
    case "faulted":
    case "cancelled":
      throw new InterpreterError(
        `A run that has not ended is not '${status}'.`,
      );
  }
}

function workflowErrorOf(error: JsonObject): WorkflowError {
  const type = error.type;
  const status = error.status;
  const instance = error.instance;

  const isTyped = typeof type === "string" && typeof status === "number";

  if (!isTyped) {
    throw new InterpreterError("A workflow error has a type and a status.");
  }

  if (typeof instance !== "string") {
    throw new InterpreterError("A workflow error is placed by its instance.");
  }

  return { ...error, type, status, instance };
}
