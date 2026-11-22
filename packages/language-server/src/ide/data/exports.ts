import type { JsonValue } from "interpreter/front-end";
import { jqStringOf, runtimeExpressionOf } from "../jq-text/index.js";
import { childPointerOf } from "../pointers/index.js";

const exportedName = /^\$\{ \$context \+ \{ ("(?:[^"\\]|\\.)*"): \. \} \}$/;

export function exportAsOf(name: string): string {
  const key = jqStringOf(name);
  const added = `$context + { ${key}: . }`;

  return runtimeExpressionOf(added);
}

export function exportAsPointerOf(pointer: string): string {
  const exported = childPointerOf(pointer, "export");

  return childPointerOf(exported, "as");
}

export function exportedNameOf(written: JsonValue | undefined): string | null {
  if (typeof written !== "string") {
    return null;
  }

  const found = exportedName.exec(written);
  const key = found?.[1];

  if (key === undefined) {
    return null;
  }

  const name: unknown = JSON.parse(key);
  const isName = typeof name === "string";

  return isName ? name : null;
}
