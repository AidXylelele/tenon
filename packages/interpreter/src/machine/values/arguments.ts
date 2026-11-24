import type {
  JsonObject,
  JsonValue,
  RuntimeDescriptor,
} from "../../api/index.js";
import type {
  Access,
  ActivationAccess,
  Expression,
  RunAccess,
} from "../../core/index.js";
import {
  InterpreterError,
  Raised,
  taskDescriptorOf,
  workflowDescriptorOf,
} from "../../runtime/index.js";
import {
  type Activation,
  type Address,
  type Scope,
  isWorkflowCell,
} from "../registers/index.js";
import type { View } from "../view.js";

export function argumentsOf(
  expression: Expression,
  scope: Scope,
  view: View,
): JsonObject {
  const entries = expression.arguments.map((argument) => {
    const value = valueAt(argument.access, scope, view);
    return [argument.name, value] as const;
  });

  return Object.fromEntries(entries);
}

export function contextOf(view: View): JsonValue {
  return view.store.context;
}

function valueAt(access: Access, scope: Scope, view: View): JsonValue {
  switch (access.kind) {
    case "slot":
      return scope.environment.slotAt(access.depth, access.index);
    case "activation":
      return activationValueOf(access, scope, view);
    case "store":
      return contextOf(view);
    case "run":
      return runValueOf(access, view);
    case "secrets":
      return secretsOf(view);
  }
}

function activationValueOf(
  access: ActivationAccess,
  scope: Scope,
  view: View,
): JsonValue {
  const activation = taskCellOf(access, scope, view);

  switch (access.field) {
    case "task":
      return taskArgumentOf(activation);
    case "authorization":
      return activation.authorization;
  }
}

function taskCellOf(
  access: ActivationAccess,
  scope: Scope,
  view: View,
): Activation {
  const address = addressOutward(scope.activation, access.hops, view);
  const cell = view.store.cellAt(address);
  const isWorkflow = isWorkflowCell(cell, address);

  if (isWorkflow) {
    throw new InterpreterError(
      `No task is running ${String(access.hops)} activations out.`,
    );
  }

  return cell;
}

function addressOutward(address: Address, hops: number, view: View): Address {
  if (hops === 0) {
    return address;
  }

  const cell = view.store.cellAt(address);
  const outward = hops - 1;

  return addressOutward(cell.enclosing, outward, view);
}

function taskArgumentOf(activation: Activation): JsonObject {
  const descriptor = activation.descriptor;

  return taskDescriptorOf({
    name: descriptor.name,
    reference: descriptor.reference,
    definition: descriptor.definition,
    input: activation.input,
    output: activation.output,
    startedAt: activation.startedAt,
  });
}

function runValueOf(access: RunAccess, view: View): JsonObject {
  switch (access.field) {
    case "workflow":
      return workflowArgumentOf(view);
    case "runtime":
      return runtimeArgumentOf(view.context.runtime);
  }
}

function workflowArgumentOf(view: View): JsonObject {
  const run = view.run;

  return workflowDescriptorOf({
    id: run.instance,
    definition: view.program.definition,
    input: run.input,
    startedAt: run.startedAt,
  });
}

function runtimeArgumentOf(runtime: RuntimeDescriptor): JsonObject {
  return {
    name: runtime.name,
    version: runtime.version,
    metadata: runtime.metadata,
  };
}

function secretsOf(view: View): JsonObject {
  const handed = view.context.secrets;
  const declared = view.program.manifest.secrets;
  const missing = declared.find((name) => !Object.hasOwn(handed, name));

  if (missing !== undefined) {
    const detail = `The secret '${missing}' was not handed to the run.`;
    throw Raised.standard("authorization", detail);
  }

  const entries = declared.map((name) => [name, handed[name] ?? null] as const);
  return Object.fromEntries(entries);
}
