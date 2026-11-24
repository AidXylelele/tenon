import { rootPointer } from "../../runtime/index.js";
import type { Finding, MessageDetails } from "../findings.js";

type SyntaxName =
  | "unparsable"
  | "expanding"
  | "selfAlias"
  | "complexKey"
  | "notJson"
  | "tooDeep";

export function syntaxFindingOf<Name extends SyntaxName>(
  name: Name,
  details: MessageDetails[Name],
): Finding<Name> {
  return {
    name,
    code: "syntax",
    pointer: rootPointer,
    subject: null,
    details,
    import: null,
  };
}
