import type { DiagnosticCode, Import } from "../../api/index.js";
import type { Catalog, Finding, FunctionCall } from "../../syntax/index.js";
import type { NameMessage, Named } from "./types.js";

export function nameFindingOf<Message extends NameMessage>(
  message: Message,
  code: DiagnosticCode,
  named: Named,
): Finding<Message> {
  return {
    name: message,
    code,
    pointer: named.pointer,
    subject: named.name,
    details: [named.name],
    import: null,
  };
}

export function unresolvedImportOf(
  call: FunctionCall,
  missing: Import,
): Finding<"unresolvedImport"> {
  return {
    name: "unresolvedImport",
    code: "unresolved-import",
    pointer: call.pointer,
    subject: missing.reference,
    details: [missing.reference],
    import: missing,
  };
}

export function dynamicCatalogOf(catalog: Catalog): Finding<"dynamicCatalog"> {
  return {
    name: "dynamicCatalog",
    code: "invalid-import",
    pointer: catalog.endpoint.uri.pointer,
    subject: null,
    details: [],
    import: null,
  };
}

export function dynamicCatalogCallOf(
  call: FunctionCall,
  catalog: string,
): Finding<"dynamicCatalog"> {
  return {
    name: "dynamicCatalog",
    code: "invalid-import",
    pointer: call.pointer,
    subject: catalog,
    details: [],
    import: null,
  };
}
