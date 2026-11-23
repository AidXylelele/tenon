export interface Missing {
  readonly kind: string;
  readonly id: string;
}

export function missingOf(pathname: string): Missing | null {
  const [first, second, third, fourth, fifth] = segmentsOf(pathname);

  if (first === "runs" && second !== undefined)
    return { kind: "run", id: second };

  if (
    first === "connections" &&
    second === "notifications" &&
    third !== undefined
  )
    return { kind: "notification", id: third };

  if (first !== "workflows" || second === undefined || third === undefined)
    return null;

  if (fourth === "versions" && fifth !== undefined)
    return { kind: "version", id: fifth };

  const id = `${second}/${third}`;
  return { kind: "workflow", id };
}

function segmentsOf(pathname: string): readonly string[] {
  return pathname
    .split("/")
    .filter((segment) => segment !== "")
    .map(decoded);
}

function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
