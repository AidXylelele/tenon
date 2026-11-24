import type { Finding, MessageName } from "../../syntax/index.js";
import { type FunctionSymbol, importedFunctionOf } from "../symbols/index.js";

const restatements: ReadonlySet<MessageName> = new Set<MessageName>([
  "invalidDuration",
  "emptyEventAttribute",
  "emptyFilterAttribute",
  "emptyImage",
  "emptyMethod",
  "emptyGrpcMember",
  "emptyOperation",
  "emptyAsyncApiTarget",
  "emptyWorkflowIdentity",
]);

const emptyTextRestatements: ReadonlySet<MessageName> = new Set<MessageName>([
  "undeclaredAuthentication",
  "undeclaredSecret",
  "unresolvedImport",
  "invalidExpression",
]);

export function placedAtCallSites(
  findings: readonly Finding[],
  functions: ReadonlyMap<string, FunctionSymbol>,
): readonly Finding[] {
  return findings.map((finding) => {
    const pointer = callSiteOf(finding.pointer, functions);
    return { ...finding, pointer };
  });
}

export function withoutRestatements(
  findings: readonly Finding[],
  flagged: readonly Finding[],
): readonly Finding[] {
  return findings.filter((finding) => !isRestatement(finding, flagged));
}

function isRestatement(finding: Finding, flagged: readonly Finding[]): boolean {
  const isFlagged = flagged.some((flag) => flag.pointer === finding.pointer);

  if (!isFlagged) {
    return false;
  }

  const isRestating = restatements.has(finding.name);
  const isOfEmptyText = isOfEmptyTextRestatement(finding);

  return isRestating || isOfEmptyText;
}

function isOfEmptyTextRestatement(finding: Finding): boolean {
  const isNamed = emptyTextRestatements.has(finding.name);
  const [written] = finding.details;

  return isNamed && written === "";
}

function callSiteOf(
  pointer: string,
  functions: ReadonlyMap<string, FunctionSymbol>,
): string {
  const callee = importedFunctionOf(pointer, functions);

  if (callee === null) {
    return pointer;
  }

  return callSiteOf(callee.site, functions);
}
