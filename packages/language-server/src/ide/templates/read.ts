import type { JsonValue } from "interpreter/front-end";
import { isPathOf, pathSource } from "../conditions/index.js";
import { isRuntimeExpression } from "../jq-text/index.js";
import { valueAt } from "../pointers/index.js";
import { type Snapshot, sourceOf } from "../snapshot/index.js";
import type {
  DataPart,
  TemplateLookup,
  TemplatePart,
  TemplateReading,
} from "./interfaces.js";

const opening = "${";

const closing = "}";

const quote = '"';

const name = "[A-Za-z_][A-Za-z0-9_]*";

const escaped = String.raw`(?:[^"\\\p{Cc}]|\\["\\/bfnrt]|\\u[0-9A-Fa-f]{4})`;

const jqPieces = new RegExp(
  String.raw`\\\(\s*(${pathSource})\s*\)|${escaped}+`,
  "guy",
);

const lastMember = new RegExp(
  String.raw`(?:^\$(${name})|\.(${name})|\["(${escaped}*)"\])$`,
  "u",
);

const noPart: TemplateReading = { kind: "template", parts: [] };

const unreadable: TemplateLookup = {
  kind: "refused",
  reason: "The text does not read; edit it in the text.",
};

export function templateAtOf(
  snapshot: Snapshot,
  pointer: string,
): TemplateLookup {
  const source = sourceOf(snapshot.analysis);

  if (source === null) {
    return unreadable;
  }

  const written = valueAt(source.document, pointer);
  return writtenTemplateOf(written, pointer);
}

export function writtenTemplateOf(
  written: JsonValue | undefined,
  pointer: string,
): TemplateLookup {
  if (written === undefined) {
    return noPart;
  }

  if (typeof written !== "string") {
    return { kind: "refused", reason: `${pointer} holds no text.` };
  }

  return templateOf(written);
}

export function templateOf(text: string): TemplateReading {
  const parts = partsOf(text);

  if (parts === null) {
    return { kind: "expression", text };
  }

  return { kind: "template", parts };
}

function partsOf(text: string): readonly TemplatePart[] | null {
  if (text === "") {
    return [];
  }

  if (!isRuntimeExpression(text)) {
    return [{ kind: "text", text }];
  }

  const trimmed = text.trim();
  const inner = trimmed.slice(opening.length, -closing.length);
  const source = inner.trim();
  const isPath = isPathOf(source);
  const isString =
    source.length > 1 && source.startsWith(quote) && source.endsWith(quote);

  if (isPath) {
    const part = dataPartOf(source);
    return [part];
  }

  if (!isString) {
    return null;
  }

  const body = source.slice(quote.length, -quote.length);
  return piecesOf(body);
}

function piecesOf(text: string): readonly TemplatePart[] | null {
  const matches = [...text.matchAll(jqPieces)];
  const last = matches.at(-1);
  const end = last === undefined ? 0 : last.index + last[0].length;

  if (end !== text.length) {
    return null;
  }

  return matches.map(pieceOf);
}

function pieceOf(match: RegExpExecArray): TemplatePart {
  const [written, path] = match;

  if (path !== undefined) {
    return dataPartOf(path);
  }

  const text = unescapedOf(written);
  return { kind: "text", text };
}

function dataPartOf(expression: string): DataPart {
  const label = labelOf(expression);

  return { kind: "data", expression, label };
}

function labelOf(path: string): string {
  const [, variable, member, key] = lastMember.exec(path) ?? [];
  const named = variable ?? member;

  if (named !== undefined) {
    return named;
  }

  if (key !== undefined) {
    return unescapedOf(key);
  }

  return path;
}

function unescapedOf(written: string): string {
  const literal = `${quote}${written}${quote}`;
  const text: unknown = JSON.parse(literal);

  return String(text);
}
