import { isPathOf } from "../conditions/index.js";
import { jqStringOf, runtimeExpressionOf } from "../jq-text/index.js";
import type { TemplatePart, TemplateText } from "./interfaces.js";

const opening = "${";

export function templateTextOf(parts: readonly TemplatePart[]): TemplateText {
  const refusals = parts.flatMap(partRefusalsOf);
  const [refusal] = refusals;
  const [only] = parts;
  const isSingle = parts.length === 1;

  if (refusal !== undefined) {
    return { kind: "refused", reason: refusal };
  }

  if (isSingle && only?.kind === "data") {
    const text = runtimeExpressionOf(only.expression);
    return { kind: "text", text };
  }

  const texts = parts.flatMap(textsOf);
  const plain = texts.join("");
  const isPlain = texts.length === parts.length && !plain.includes(opening);

  if (isPlain) {
    return { kind: "text", text: plain };
  }

  const pieces = parts.map(pieceOf);
  const string = `"${pieces.join("")}"`;
  const text = runtimeExpressionOf(string);
  return { kind: "text", text };
}

function partRefusalsOf(part: TemplatePart): readonly string[] {
  switch (part.kind) {
    case "text":
      return [];
    case "data": {
      const isPath = isPathOf(part.expression);
      return isPath ? [] : [`'${part.expression}' is not a path to data.`];
    }
  }
}

function textsOf(part: TemplatePart): readonly string[] {
  switch (part.kind) {
    case "text":
      return [part.text];
    case "data":
      return [];
  }
}

function pieceOf(part: TemplatePart): string {
  switch (part.kind) {
    case "text": {
      const string = jqStringOf(part.text);
      return string.slice(1, -1);
    }
    case "data":
      return `\\(${part.expression})`;
  }
}
