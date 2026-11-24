import type { InputProblem, JsonValue } from "../../api/index.js";
import type {
  CompiledSchema,
  FetchedSchema,
  Validate,
} from "../../core/index.js";
import {
  InterpreterError,
  Raised,
  type Validator,
} from "../../runtime/index.js";
import { deepestViolationsOf } from "../../syntax/index.js";
import { normalOf } from "../completions/index.js";
import { type Building, effectOf } from "../effects/index.js";
import { type AwaitK, awaitK, validateK } from "../frames/index.js";
import { effectIdOf, schemaKeyOf } from "../identity/index.js";
import type { Here } from "../registers/index.js";
import {
  type Transition,
  type Write,
  requested,
  returning,
  suspending,
  transitionOf,
} from "../transitions/index.js";
import { heldValuesOf } from "../values/index.js";
import type { View } from "../view.js";

interface Fetch {
  readonly asked: Write;
  readonly awaiting: AwaitK;
}

export function evaluateValidate(
  term: Validate,
  here: Here,
  view: View,
): Transition {
  const schema = term.schema;

  switch (schema.kind) {
    case "compiled": {
      checkCompiled(schema, here.value, view);
      const done = normalOf(here.value);
      const next = returning(done);
      return transitionOf(next, [], []);
    }
    case "fetched": {
      const frame = validateK({ subject: here.value });
      const fetch = fetchOf(schema, here, view);
      const frames = [frame, fetch.awaiting];
      const writes = [fetch.asked];
      return transitionOf(suspending, frames, writes);
    }
  }
}

export function checkCompiled(
  schema: CompiledSchema,
  subject: JsonValue,
  view: View,
): void {
  const validator = view.program.schemas.get(schema.id);

  if (validator === undefined) {
    throw new InterpreterError(
      `The program compiled no schema '${schema.id}'.`,
    );
  }

  checkWith(validator, subject);
}

export function problemsOf(
  validator: Validator,
  subject: JsonValue,
): readonly InputProblem[] {
  const violations = validator(subject);
  const named = violations.map((violation) => ({
    ...violation,
    pointer: violation.subject,
  }));
  const chosen = deepestViolationsOf(named);
  const problems = chosen.map(({ pointer, message }) => ({
    pointer,
    detail: message,
  }));

  return Object.freeze(problems);
}

export function checkWith(validator: Validator, subject: JsonValue): void {
  const violations = validator(subject);

  if (violations.length > 0) {
    throw Raised.refused(violations);
  }
}

export function fetchOf(schema: FetchedSchema, here: Here, view: View): Fetch {
  const key = schemaKeyOf(here.scope.path, schema.id);
  const values = heldValuesOf(schema.resource, here, view);
  const id = effectIdOf(key);
  const building: Building = { input: here.value, values, id, view };
  const effect = effectOf(schema.resource, building);
  const asked = requested(effect);
  const awaiting = awaitK({ effect: key, activation: here.scope.activation });

  return { asked, awaiting };
}
