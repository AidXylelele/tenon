import type { CatalogReference } from "./types.js";

const catalogReference = /^[^:@/\s]+:[^@/\s]+@[^@/\s]+$/;

export function catalogReferenceOf(target: string): CatalogReference | null {
  const matches = catalogReference.test(target);

  if (!matches) {
    return null;
  }

  const colon = target.indexOf(":");
  const versionStart = colon + 1;
  const at = target.indexOf("@");
  const catalogStart = at + 1;

  return {
    name: target.slice(0, colon),
    version: target.slice(versionStart, at),
    catalog: target.slice(catalogStart),
  };
}
