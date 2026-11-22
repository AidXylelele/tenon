const millisecondsPerSecond = 1_000;

export function secondsSince(started: number): number {
  const elapsed = performance.now() - started;

  return elapsed / millisecondsPerSecond;
}

export function secondsBetween(earlier: number, later: number): number {
  const elapsed = later - earlier;

  return elapsed / millisecondsPerSecond;
}
