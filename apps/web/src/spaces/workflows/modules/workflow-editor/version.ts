import { PublishedVersion } from "./form";

export const VERSION_POINTER = "/document/version";

export function nextVersion(version: string): string {
  const parts = partsOf(version);

  if (parts === null) return version;

  const [major, minor, patch] = parts;
  return `${String(major)}.${String(minor)}.${String(patch + 1)}`;
}

export function freeVersion(
  document: unknown,
  current: string | null,
): string | null {
  const parsed = PublishedVersion.safeParse(document);

  if (!parsed.success) return null;

  const written = parsed.data.document.version;
  const newest =
    current !== null && isLater(current, written) ? current : written;
  return nextVersion(newest);
}

function isLater(one: string, other: string): boolean {
  const a = partsOf(one);
  const b = partsOf(other);

  if (a === null || b === null) return false;

  const index = a.findIndex((part, at) => part !== b[at]);
  return index >= 0 && (a[index] ?? 0) > (b[index] ?? 0);
}

function partsOf(version: string): readonly [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);

  if (match === null) return null;

  const [, major = "0", minor = "0", patch = "0"] = match;
  return [Number(major), Number(minor), Number(patch)];
}
