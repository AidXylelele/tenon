export function repeatedOf(numbers: readonly number[]): number | undefined {
  const seen = new Set<number>();

  for (const value of numbers) {
    const isSeen = seen.has(value);

    if (isSeen) {
      return value;
    }

    seen.add(value);
  }

  return undefined;
}
