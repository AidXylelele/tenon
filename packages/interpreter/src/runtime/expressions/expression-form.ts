import type { JsonValue } from "../../api/index.js";
import { isKeptByEngine } from "./engine-limits.js";
import type { ExpressionForm } from "./types.js";

const programForm: ExpressionForm = { kind: "program" };
const path =
  /^[ \t\n\r]*(?:\$([A-Za-z_]\w*)((?:\.[A-Za-z_]\w*)*)|((?:\.[A-Za-z_]\w*)+)|\.)[ \t\n\r]*$/;
const constant =
  /^[ \t\n\r]*(true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|"[^"\\\p{Cc}]*")[ \t\n\r]*$/u;

export function expressionFormOf(
  source: string,
  names: readonly string[],
): ExpressionForm {
  const writtenPath = path.exec(source);

  if (writtenPath !== null) {
    return pathFormOf(writtenPath, names);
  }

  const literal = constant.exec(source)?.[1] ?? null;

  if (literal !== null) {
    return constantFormOf(literal);
  }

  return programForm;
}

function pathFormOf(
  match: RegExpExecArray,
  names: readonly string[],
): ExpressionForm {
  const [, variable = null, variableKeys = "", dataKeys = ""] = match;
  const rooted = variable === null || names.includes(variable);

  if (!rooted) {
    return programForm;
  }

  const written = variableKeys + dataKeys;
  const keys = written.split(".").slice(1);

  return { kind: "path", variable, keys };
}

function constantFormOf(literal: string): ExpressionForm {
  const value = JSON.parse(literal) as JsonValue;
  const kept = isKeptByEngine(value);

  return kept ? { kind: "constant", value } : programForm;
}
