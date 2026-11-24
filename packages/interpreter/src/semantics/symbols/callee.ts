import type { Import } from "../../api/index.js";
import { defaultCatalog } from "../../standard/index.js";
import type { Catalog, Use } from "../../syntax/index.js";
import { catalogReferenceOf } from "./catalog-reference.js";
import { catalogRootOf } from "./catalogs.js";
import { functionUriOf } from "./function-uri.js";
import type { Callee, CatalogReference } from "./types.js";

const declared: Callee = { kind: "declared" };
const undeclaredFunction: Callee = { kind: "undeclaredFunction" };

export function calleeOf(target: string, use: Use): Callee {
  const reference = catalogReferenceOf(target);

  const isDeclared = use.functions.has(target);

  if (isDeclared) {
    return declared;
  }

  if (reference !== null) {
    return catalogCalleeOf(target, reference, use.catalogs);
  }

  const addressed = target.includes("://") && URL.canParse(target);

  if (!addressed) {
    return undeclaredFunction;
  }

  return importedOf(target, target);
}

function catalogCalleeOf(
  target: string,
  reference: CatalogReference,
  catalogs: ReadonlyMap<string, Catalog>,
): Callee {
  const catalog = catalogs.get(reference.catalog);

  if (catalog === undefined) {
    return undeclaredCatalogCalleeOf(target, reference);
  }

  const root = catalogRootOf(catalog);

  if (root === null) {
    return { kind: "unlinked", catalog: reference.catalog };
  }

  const uri = functionUriOf(root, reference);
  return importedOf(target, uri);
}

function undeclaredCatalogCalleeOf(
  target: string,
  reference: CatalogReference,
): Callee {
  if (reference.catalog !== defaultCatalog) {
    return { kind: "undeclaredCatalog", catalog: reference.catalog };
  }

  return importedOf(target, null);
}

function importedOf(reference: string, uri: string | null): Callee {
  const imported: Import = { reference, uri };
  return { kind: "imported", import: imported };
}
