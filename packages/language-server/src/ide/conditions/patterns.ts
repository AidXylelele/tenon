import { timeExpressions } from "../jq-text/index.js";

const name = "[A-Za-z_][A-Za-z0-9_]*";

const key = String.raw`\["(?:[^"\\]|\\.)*"\]`;

const segment = String.raw`(?:\.${name}|${key})`;

export const pathSource = String.raw`(?:\.|\$${name}${segment}*|\.(?:${name}|${key})${segment}*)`;

export const textSource = String.raw`"(?:[^"\\]|\\.)*"`;

export const literalSource = String.raw`(?:"(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)`;

const timeTexts = Object.values(timeExpressions).map(escapedOf);

const timeSource = String.raw`\((?:${timeTexts.join("|")})\)`;

export const operandSource = `(?:${pathSource}|${literalSource}|${timeSource})`;

const path = new RegExp(`^${pathSource}$`);

const literal = new RegExp(`^${literalSource}$`);

export function isPathOf(text: string): boolean {
  return path.test(text);
}

export function isLiteralOf(text: string): boolean {
  return literal.test(text);
}

function escapedOf(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
