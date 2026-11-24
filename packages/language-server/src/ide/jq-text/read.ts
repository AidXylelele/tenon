const opening = "${";

const closing = "}";

export function isRuntimeExpression(text: string): boolean {
  const trimmed = text.trim();

  return trimmed.startsWith(opening) && trimmed.endsWith(closing);
}

export function holdsWrittenReference(text: string): boolean {
  const isWrittenIn = text.includes(opening);

  return isWrittenIn && !isRuntimeExpression(text);
}
