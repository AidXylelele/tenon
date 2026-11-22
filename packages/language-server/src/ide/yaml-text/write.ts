import type { JsonValue } from "interpreter/front-end";
import { CST, type Scalar, stringify, type ToStringOptions } from "yaml";
import type { WrittenScalar } from "./interfaces.js";

const levelIndent = 2;

const newTokenOffset = -1;

const unfoldedBlockStyle: ToStringOptions = {
  indent: levelIndent,
  lineWidth: 0,
};

const blockStyles: ReadonlySet<Scalar.Type> = new Set([
  "BLOCK_LITERAL",
  "BLOCK_FOLDED",
]);

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

export function lineInBlockLike(written: WrittenScalar, value: string): string {
  const style = styleOf(written.text);
  const isBlockStyle = blockStyles.has(style);
  const lineStyle = isBlockStyle ? "PLAIN" : style;
  const options: ToStringOptions = {
    lineWidth: 0,
    defaultStringType: lineStyle,
  };
  const text = stringify(value, options).trimEnd();
  const isOneLine = !text.includes("\n");
  const quoted = oneLineOf(value, "QUOTE_DOUBLE");
  const line = isOneLine ? text : quoted;
  const comment = headerCommentOf(written);

  return `${line}${comment}`;
}

export function isBlockScalarFor(
  written: WrittenScalar,
  value: string,
): boolean {
  const hasLineBreak = value.includes("\n");
  const style = styleOf(written.text);
  const isWrittenAsBlock = blockStyles.has(style);
  const isKeptAsBlock = isWrittenAsBlock && value !== "";
  const isWanted = hasLineBreak || isKeptAsBlock;
  const isAbsorbing = isAbsorbingOf(written, value);

  return isWanted && !isAbsorbing;
}

export function isKeptBlockOf(written: string): boolean {
  const style = styleOf(written);
  const isWrittenAsBlock = blockStyles.has(style);
  const [header = ""] = written.split("\n", 1);
  const [indicators = ""] = header.split(/\s/, 1);

  return isWrittenAsBlock && indicators.includes("+");
}

export function blockScalarLike(written: WrittenScalar, value: string): string {
  const hasLineBreak = value.includes("\n");
  const type = hasLineBreak ? "BLOCK_LITERAL" : styleOf(written.text);
  const indent = written.indent + levelIndent;
  const kept = keptCommentOf(written);
  const end = commentTokensOf(kept, indent);
  const token = CST.createScalarToken(value, { indent, type, end });
  const source = CST.stringify(token);

  return source.replace(/\n$/, "");
}

function keptCommentOf(written: WrittenScalar): string {
  const style = styleOf(written.text);
  const isWrittenAsBlock = blockStyles.has(style);

  if (!isWrittenAsBlock) {
    return written.trailing;
  }

  return headerCommentOf(written);
}

function headerCommentOf(written: WrittenScalar): string {
  const style = styleOf(written.text);
  const isWrittenAsBlock = blockStyles.has(style);
  const [header = ""] = written.text.split("\n", 1);

  if (!isWrittenAsBlock) {
    return "";
  }

  return header.replace(/^\S+/, "");
}

function isAbsorbingOf(written: WrittenScalar, value: string): boolean {
  const following = written.following;
  const content = following.trimStart();
  const depth = following.length - content.length;
  const keepsLines = value.endsWith("\n\n") || value === "\n";
  const isEmptyLine = content === "";
  const isComment = content.startsWith("#");
  const isUnder = depth >= written.indent + levelIndent;
  const takesEmptyLine = keepsLines && isEmptyLine;
  const takesComment = isComment && isUnder;

  return takesEmptyLine || takesComment;
}

function commentTokensOf(kept: string, indent: number): CST.SourceToken[] {
  const comment = kept.trimStart();
  const spaceLength = kept.length - comment.length;
  const space = kept.slice(0, spaceLength);

  if (comment === "") {
    return [];
  }

  return [
    { type: "space", offset: newTokenOffset, indent, source: space },
    { type: "comment", offset: newTokenOffset, indent, source: comment },
  ];
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

  if (written.startsWith("|")) {
    return "BLOCK_LITERAL";
  }

  if (written.startsWith(">")) {
    return "BLOCK_FOLDED";
  }

  return "PLAIN";
}
