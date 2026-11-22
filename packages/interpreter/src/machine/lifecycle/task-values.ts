import type { JsonValue, TaskValue } from "../../api/index.js";
import { executionOf } from "../identity/index.js";
import type { Address } from "../registers/index.js";
import { type Write, given, taken } from "../transitions/index.js";
import type { View } from "../view.js";

export function inputTakenOf(
  address: Address,
  input: JsonValue,
  view: View,
): Write {
  const value = taskValueOf(address, input, view);
  return taken(value);
}

export function outputGivenOf(
  address: Address,
  output: JsonValue,
  view: View,
): Write {
  const value = taskValueOf(address, output, view);
  return given(value);
}

function taskValueOf(
  address: Address,
  value: JsonValue,
  view: View,
): TaskValue {
  const cell = view.store.cellAt(address);
  const execution = executionOf(cell.path);

  return { execution, value };
}
