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
