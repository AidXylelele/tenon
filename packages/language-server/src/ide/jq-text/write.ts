const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;

const identity = ".";

export function memberAccessOf(base: string, name: string): string {
  const isIdentifier = identifier.test(name);

  if (!isIdentifier) {
    const key = jqStringOf(name);
    return `${base}[${key}]`;
  }

  const head = base === identity ? "" : base;
  return `${head}.${name}`;
}

export function runtimeExpressionOf(expression: string): string {
  return `\${ ${expression} }`;
}

export function jqStringOf(text: string): string {
  return JSON.stringify(text);
}
