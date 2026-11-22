import type { Binding } from "../../semantics/index.js";
import type { RuntimeArgument } from "../../standard/index.js";
import {
  type Access,
  type SlotAccess,
  type SlotArgument,
  type SlotMeaning,
  activationAccess,
  argumentMeaning,
  runAccess,
  secretsAccess,
  slotAccess,
  storeAccess,
} from "../forms/index.js";
import type { StaticEnvironment } from "./static-environment.js";
import type { StaticScope } from "./types.js";

export function accessOf(binding: Binding, scope: StaticScope): Access {
  switch (binding.kind) {
    case "argument":
      return argumentAccessOf(binding.argument, scope);
    case "binder":
      return slotAccessOf(binding, scope.environment);
  }
}

function argumentAccessOf(
  argument: RuntimeArgument,
  scope: StaticScope,
): Access {
  switch (argument) {
    case "input":
    case "output":
      return argumentSlotAccessOf(argument, scope.environment);
    case "task":
      return taskAccessOf(scope);
    case "authorization":
      return activationAccess({ hops: 0, field: "authorization" });
    case "context":
      return storeAccess;
    case "workflow":
    case "runtime":
      return runAccess({ field: argument });
    case "secrets":
      return secretsAccess;
  }
}

function argumentSlotAccessOf(
  argument: SlotArgument,
  environment: StaticEnvironment,
): SlotAccess {
  const meaning = argumentMeaning({ argument });

  return slotAccessOf(meaning, environment);
}

function taskAccessOf(scope: StaticScope): Access {
  const hops = scope.activations.taskHops;

  return activationAccess({ hops, field: "task" });
}

function slotAccessOf(
  meaning: SlotMeaning,
  environment: StaticEnvironment,
): SlotAccess {
  const slot = environment.slotOf(meaning);

  return slotAccess(slot);
}
