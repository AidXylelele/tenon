import { isPointerWithin } from "../../runtime/index.js";
import type { Finding } from "../../syntax/index.js";
import { type FunctionSymbol, importedFunctionOf } from "../symbols/index.js";

export function placedAtCallSites(
  findings: readonly Finding[],
  functions: ReadonlyMap<string, FunctionSymbol>,
): readonly Finding[] {
  return findings.map((finding) => {
    const pointer = callSiteOf(finding.pointer, functions);
    return { ...finding, pointer };
  });
}

export function atUnflaggedPlaces(
  findings: readonly Finding[],
  flagged: readonly Finding[],
): readonly Finding[] {
  return findings.filter((finding) => !isFlagged(finding, flagged));
}

function isFlagged(finding: Finding, flagged: readonly Finding[]): boolean {
  return flagged.some((flag) => isPointerWithin(finding.pointer, flag.pointer));
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
