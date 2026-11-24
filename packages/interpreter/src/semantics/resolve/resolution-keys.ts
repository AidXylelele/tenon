export function resolutionKeyOf(
  expression: string,
  place: string | null,
): string {
  if (place === null) {
    return expression;
  }

  return `${expression}@${place}`;
}
