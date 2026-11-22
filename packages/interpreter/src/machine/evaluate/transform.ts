import type { Transform } from "../../core/index.js";
import { normalOf } from "../completions/index.js";
import type { Here } from "../registers/index.js";
import {
  type Transition,
  returning,
  transitionOf,
} from "../transitions/index.js";
import { directReader, templateValueOf } from "../values/index.js";
import type { View } from "../view.js";
import { releasedOf } from "./release.js";

export function evaluateTransform(
  term: Transform,
  here: Here,
  view: View,
): Transition {
  const reader = directReader(here, view);
  const value = templateValueOf(term.value, here.value, reader);
  const released = releasedOf(term, here, view);
  const done = normalOf(value);
  const next = returning(done);

  return transitionOf(next, [], released);
}
