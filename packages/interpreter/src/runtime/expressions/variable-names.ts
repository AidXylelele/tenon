import { InterpreterError } from "../faults/index.js";
const identifier = "[A-Za-z_][A-Za-z0-9_]*";
const mention = String.raw`\$(?<variable>${identifier})`;
const declarable = new RegExp(`^${identifier}$`);
const engineVariables: ReadonlySet<string> = new Set([
  "ENV",
  "ARGS",
  "JQ_BUILD_CONFIGURATION",
  "__loc__",
]);
const wordEnd = "(?![A-Za-z0-9_])";
// jq 1.8 goes on with a comment past a backslash that ends its line.
const comment = String.raw`#(?:[^\\\n]|\\[^])*`;
const blank = String.raw`(?:[ \t\n\r]|${comment})*`;
const stringInside = String.raw`(?:[^"\\\p{Cc}]|\\["\\/bfnrt]|\\u[0-9A-Fa-f]{4})*`;
const member = String.raw`(?:\.(?<member>${identifier})|\.${blank}"(?<member>${stringInside})"|(?:\.${blank})?\[${blank}"(?<member>${stringInside})"${blank}\])`;
const access = String.raw`${blank}(?:\?${blank})?(?:${member}|(?<path>[.[]))`;
const otherCode = String.raw`(?:[^$#"()|.A-Za-z_]|\.(?![A-Za-z_]))+`;
const codeLexeme = new RegExp(
  String.raw`${mention}(?:${access})?|(?<as>as)${wordEnd}|(?<parameters>def${wordEnd}${blank}${identifier}${blank}\()|(?<parenthesis>\()|(?<end>\))|(?<pipe>\|)(?!=)|(?<string>")|${comment}|\.?${identifier}|${otherCode}`,
  "uy",
);
const textLexeme = /(?<parenthesis>\\\()|(?<quote>")|\\[^]|[^\\"]+/uy;
const delimiters = ["as", "parameters", "pipe", "end"] as const;
const noNames: readonly string[] = [];

type Frame = "parenthesis" | "string";

interface Place {
  readonly at: number;
  readonly frames: readonly Frame[];
}

interface Mention {
  readonly kind: "variable";
  readonly name: string;
  readonly member: string | null;
  readonly bare: boolean;
}

interface Delimiter {
  readonly kind: (typeof delimiters)[number];
  readonly depth: number;
}

type Lexeme = Mention | Delimiter;

interface Lexed {
  readonly lexemes: readonly Lexeme[];
  readonly next: Place;
}

type Groups = Readonly<Record<string, string | undefined>>;

const origin: Place = { at: 0, frames: [] };
const noLexemes: readonly Lexeme[] = [];

export function variablesOf(source: string): readonly string[] {
  const code = codeOf(source);
  const mentions = mentionsIn(code);
  const written = mentions.map((mentioned) => mentioned.name);
  const names = new Set(written);
  const bindable = Array.from(names);

  return bindable.filter((name) => !engineVariables.has(name));
}

export function checkDeclaredNames(names: readonly string[]): void {
  const undeclarable = names.find((name) => !isDeclarable(name));

  if (undeclarable === undefined) {
    return;
  }

  throw new InterpreterError(
    `'${undeclarable}' cannot be declared to jq: a declared name is a jq identifier other than ENV, ARGS, JQ_BUILD_CONFIGURATION and __loc__.`,
  );
}

function isDeclarable(name: string): boolean {
  return declarable.test(name) && !engineVariables.has(name);
}

export function memberNamesOf(
  source: string,
  variable: string,
): readonly string[] {
  const code = codeOf(source);
  const binders = bindersOf(code);
  const rebound = binders.has(variable);

  if (rebound) {
    return noNames;
  }

  const reads = mentionsIn(code).filter(
    (mentioned) => mentioned.name === variable,
  );
  const members = reads
    .map((read) => read.member)
    .filter((read) => read !== null);
  const names = new Set(members);

  return Array.from(names);
}

function bindersOf(code: readonly Lexeme[]): ReadonlySet<string> {
  const places = code.flatMap((lexeme, index) =>
    bindingPlaceOf(code, lexeme, index),
  );
  const binders = mentionsIn(places).filter((mentioned) => mentioned.bare);
  const names = binders.map((binder) => binder.name);

  return new Set(names);
}

function bindingPlaceOf(
  code: readonly Lexeme[],
  lexeme: Lexeme,
  index: number,
): readonly Lexeme[] {
  switch (lexeme.kind) {
    case "as":
      return lexemesAfter(code, index, (later) =>
        closesPatternAt(later, lexeme.depth),
      );
    case "parameters":
      return lexemesAfter(code, index, (later) => later.kind === "end");
    case "variable":
    case "pipe":
    case "end":
      return noLexemes;
  }
}

function closesPatternAt(lexeme: Lexeme, depth: number): boolean {
  switch (lexeme.kind) {
    case "pipe":
    case "end":
      return lexeme.depth === depth;
    case "variable":
    case "as":
    case "parameters":
      return false;
  }
}

function lexemesAfter(
  code: readonly Lexeme[],
  index: number,
  closes: (lexeme: Lexeme) => boolean,
): readonly Lexeme[] {
  const start = index + 1;
  const closing = code.findIndex((lexeme, at) => at > index && closes(lexeme));
  const unclosed = closing === -1;
  const end = unclosed ? code.length : closing;

  return code.slice(start, end);
}

function mentionsIn(code: readonly Lexeme[]): readonly Mention[] {
  return code.filter((lexeme) => lexeme.kind === "variable");
}

function codeOf(source: string): readonly Lexeme[] {
  const inCode = new RegExp(codeLexeme);
  const inText = new RegExp(textLexeme);
  const code: Lexeme[] = [];

  for (let place = origin; place.at < source.length;) {
    const inString = place.frames.at(-1) === "string";
    const lexer = inString ? inText : inCode;

    lexer.lastIndex = place.at;
    const match = lexer.exec(source);
    const lexed = lexedOf(match, place, source);

    code.push(...lexed.lexemes);
    place = lexed.next;
  }

  return code;
}

function lexedOf(
  match: RegExpExecArray | null,
  place: Place,
  source: string,
): Lexed {
  const written = match?.[0] ?? source.charAt(place.at);
  const groups: Groups = match?.groups ?? {};
  const at = place.at + written.length;
  const frames = framesAfter(place.frames, groups);
  const depth = place.frames.length;
  const lexemes = lexemesOf(groups, depth);

  return { lexemes, next: { at, frames } };
}

function framesAfter(
  frames: readonly Frame[],
  groups: Groups,
): readonly Frame[] {
  const opensParenthesis =
    groups.parenthesis !== undefined || groups.parameters !== undefined;

  if (opensParenthesis) {
    return [...frames, "parenthesis"];
  }

  if (groups.string !== undefined) {
    return [...frames, "string"];
  }

  const closes = groups.end !== undefined || groups.quote !== undefined;

  if (closes) {
    return frames.slice(0, -1);
  }

  return frames;
}

function lexemesOf(groups: Groups, depth: number): readonly Lexeme[] {
  const { variable } = groups;

  if (variable !== undefined) {
    const mentioned = mentionOf(variable, groups);
    return [mentioned];
  }

  const delimiter = delimiters.find((kind) => groups[kind] !== undefined);

  if (delimiter === undefined) {
    return noLexemes;
  }

  return [{ kind: delimiter, depth }];
}

function mentionOf(name: string, groups: Groups): Mention {
  const { member, path } = groups;
  const bare = member === undefined && path === undefined;

  if (member === undefined) {
    return { kind: "variable", name, member: null, bare };
  }

  const quoted = `"${member}"`;
  const read = JSON.parse(quoted) as string;
  return { kind: "variable", name, member: read, bare };
}
