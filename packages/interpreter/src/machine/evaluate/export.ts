import type { JsonValue } from "../../api/index.js";
import type { Export } from "../../core/index.js";
import { normalOf } from "../completions/index.js";
import { exportK } from "../frames/index.js";
import type { Here } from "../registers/index.js";
import {
  type Transition,
  type Write,
  committed,
  returning,
  suspending,
  transitionOf,
} from "../transitions/index.js";
import { directReader, templateValueOf } from "../values/index.js";
import type { View } from "../view.js";
import { releasedOf } from "./release.js";
import { checkCompiled, fetchOf } from "./validate.js";

export function evaluateExport(
  term: Export,
  here: Here,
  view: View,
): Transition {
  const reader = directReader(here, view);
  const context = templateValueOf(term.value, here.value, reader);
  const released = releasedOf(term, here, view);
  const schema = term.schema;

  switch (schema.kind) {
    case "unchecked":
      return exportedOf(context, here.value, released);
    case "compiled":
      checkCompiled(schema, context, view);
      return exportedOf(context, here.value, released);
    case "fetched": {
      const checked: Here = { scope: here.scope, value: context };
      const frame = exportK({ context, value: here.value });
      const fetch = fetchOf(schema, checked, view);
      const frames = [frame, fetch.awaiting];
      const writes = [...released, fetch.asked];
      return transitionOf(suspending, frames, writes);
    }
  }
}

export function exportedOf(
  context: JsonValue,
  value: JsonValue,
  released: readonly Write[],
): Transition {
  const commit = committed(context);
  const writes = [...released, commit];
  const done = normalOf(value);
  const next = returning(done);

  return transitionOf(next, [], writes);
}
