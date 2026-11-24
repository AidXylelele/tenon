const CONTENT_MODIFIED = -32801;

export function isOutdated(failure: unknown): boolean {
  return codeOf(failure) === CONTENT_MODIFIED;
}

export function reasonOf(failure: unknown): string {
  if (typeof failure === "object" && failure !== null && "message" in failure)
    return String(failure.message);

  return String(failure);
}

function codeOf(failure: unknown): unknown {
  if (typeof failure === "object" && failure !== null && "code" in failure)
    return failure.code;

  return null;
}
