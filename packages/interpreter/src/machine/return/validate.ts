import type { JsonValue } from "../../api/index.js";
import { Raised, type Validator } from "../../runtime/index.js";
import { type Completion, normalOf } from "../completions/index.js";
import { checkWith } from "../evaluate/index.js";
import type { ValidateK } from "../frames/index.js";
import {
  type Transition,
  returning,
  transitionOf,
} from "../transitions/index.js";
import type { View } from "../view.js";

export function returnToValidate(
  frame: ValidateK,
  completion: Completion,
  view: View,
): Transition {
  const validator = fetchedValidatorOf(completion.value, view);

  checkWith(validator, frame.subject);

  const done = normalOf(frame.subject);
  const next = returning(done);
  return transitionOf(next, [], []);
}

export function fetchedValidatorOf(document: JsonValue, view: View): Validator {
  const compilation = view.services.schemas.compile(document);

  switch (compilation.kind) {
    case "compiled":
      return compilation.validator;
    case "invalid":
      throw Raised.standard("configuration", compilation.message);
  }
}
