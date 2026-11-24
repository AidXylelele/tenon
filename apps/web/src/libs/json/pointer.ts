export function pointerOf(keys: readonly string[]): string {
  const segments = keys.map(
    (key) => `/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
  );
  return segments.join("");
}

export function keysOf(pointer: string): string[] {
  const segments = pointer.split("/").slice(1);
  return segments.map((segment) =>
    segment.replaceAll("~1", "/").replaceAll("~0", "~"),
  );
}
