import type { JsonValue } from "interpreter/front-end";
import { type Scalar, stringify, type ToStringOptions } from "yaml";

const unfoldedBlockStyle: ToStringOptions = { indent: 2, lineWidth: 0 };

export function yamlOf(value: JsonValue): string {
  return stringify(value, unfoldedBlockStyle);
}

export function inlineYamlOf(value: JsonValue): string {
  return oneLineOf(value, "PLAIN");
}

export function scalarLike(written: string, value: string): string {
  const style = styleOf(written);

  return oneLineOf(value, style);
}

function oneLineOf(value: JsonValue, style: Scalar.Type): string {
  const text = inlineTextOf(value, style);
  const isOneLine = !text.includes("\n");

  if (isOneLine) {
    return text;
  }

  return inlineTextOf(value, "QUOTE_DOUBLE");
}

function inlineTextOf(value: JsonValue, style: Scalar.Type): string {
  const options: ToStringOptions = {
    collectionStyle: "flow",
    lineWidth: 0,
    blockQuote: false,
    defaultStringType: style,
  };

  return stringify(value, options).trimEnd();
}

function styleOf(written: string): Scalar.Type {
  if (written.startsWith('"')) {
    return "QUOTE_DOUBLE";
  }

  if (written.startsWith("'")) {
    return "QUOTE_SINGLE";
  }

  return "PLAIN";
}
