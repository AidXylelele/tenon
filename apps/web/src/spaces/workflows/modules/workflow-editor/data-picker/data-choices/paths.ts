const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const SEGMENT = String.raw`(?:\.[A-Za-z_][A-Za-z0-9_]*|\["(?:[^"\\]|\\.)*"\])`;

const PATH = new RegExp(
  String.raw`^(?:\.|\$[A-Za-z_][A-Za-z0-9_]*)?${SEGMENT}*$`,
);

const TYPED_FIELD = /^[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)*$/;

export function memberPathOf(base: string, name: string): string {
  const key = IDENTIFIER.test(name) ? `.${name}` : `[${JSON.stringify(name)}]`;
  const isRoot = base === ".";
  const isBracket = key.startsWith("[");

  if (isRoot && isBracket) return `.${key}`;

  if (isRoot) return key;

  return `${base}${key}`;
}

export function valueOf(expression: string): string {
  return `\${ ${expression} }`;
}

export function isPath(expression: string): boolean {
  return expression === "." || (expression !== "" && PATH.test(expression));
}

export function typedNamesOf(query: string): readonly string[] | null {
  const typed = query.trim();

  if (!TYPED_FIELD.test(typed)) return null;

  return typed.split(".");
}
