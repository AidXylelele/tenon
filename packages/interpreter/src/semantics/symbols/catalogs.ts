import type { Catalog, Finding, Use } from "../../syntax/index.js";
import { writtenTextOf } from "../written/index.js";
import { dynamicCatalogOf } from "./findings.js";

export function catalogRootOf(catalog: Catalog): string | null {
  return writtenTextOf(catalog.endpoint.uri);
}

export function catalogFindingsOf(use: Use): readonly Finding[] {
  const catalogs = [...use.catalogs.values()];
  const computed = catalogs.filter(
    (catalog) => catalogRootOf(catalog) === null,
  );

  return computed.map(dynamicCatalogOf);
}
