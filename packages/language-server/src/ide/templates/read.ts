import type { JsonValue } from "interpreter/front-end";
import { isPathOf, pathSource } from "../conditions/index.js";
import { valueAt } from "../pointers/index.js";
import { type Snapshot, sourceOf } from "../snapshot/index.js";
import type {
  DataPart,
  TemplateForm,
  TemplateLookup,
  TemplatePart,
  TemplateReading,
} from "./interfaces.js";

const opening = "${";

const closing = "}";

const quote = '"';

const name = "[A-Za-z_][A-Za-z0-9_]*";

const escaped = String.raw`(?:[^"\\\p{Cc}]|\\["\\/bfnrt]|\\u[0-9A-Fa-f]{4})`;

const jqForm: TemplateForm = {
  pieces: new RegExp(
    String.raw`\\\(\s*(${pathSource})\s*\)|${escaped}+`,
    "guy",
  ),
  isEscaped: true,
};

const textForm: TemplateForm = {
  pieces: new RegExp(
    String.raw`\$\{\s*(${pathSource})\s*\}|(?:(?!\$\{)[\s\S])+`,
    "guy",
  ),
  isEscaped: false,
};

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
  const trimmed = text.trim();
  const isExpression = trimmed.startsWith(opening) && trimmed.endsWith(closing);

  if (!isExpression) {
    return piecesOf(text, textForm);
  }

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
  return piecesOf(body, jqForm);
}

function piecesOf(
  text: string,
  form: TemplateForm,
): readonly TemplatePart[] | null {
  const matches = [...text.matchAll(form.pieces)];
  const last = matches.at(-1);
  const end = last === undefined ? 0 : last.index + last[0].length;

  if (end !== text.length) {
    return null;
  }

  return matches.map((match) => pieceOf(match, form));
}

function pieceOf(match: RegExpExecArray, form: TemplateForm): TemplatePart {
  const [written, path] = match;

  if (path !== undefined) {
    return dataPartOf(path);
  }

  const text = form.isEscaped ? unescapedOf(written) : written;
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
