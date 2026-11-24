import type * as ast from "../../../syntax/index.js";
import { type TimerTemplate, timerTemplate } from "../../forms/index.js";
import type { Context } from "../context.js";
import { durationOf } from "../durations.js";

export function timerTemplateOf(
  written: ast.Duration,
  context: Context,
): TimerTemplate {
  const duration = durationOf(written, context);
  return timerTemplate({ duration });
}
