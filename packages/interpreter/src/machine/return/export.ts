import type { Completion } from "../completions/index.js";
import { checkWith, exportedOf } from "../evaluate/index.js";
import type { ExportK } from "../frames/index.js";
import type { Transition } from "../transitions/index.js";
import type { View } from "../view.js";
import { fetchedValidatorOf } from "./validate.js";

export function returnToExport(
  frame: ExportK,
  completion: Completion,
  view: View,
): Transition {
  const validator = fetchedValidatorOf(completion.value, view);

  checkWith(validator, frame.context);
  return exportedOf(frame.context, frame.value, []);
}
