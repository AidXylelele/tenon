import type { Finding } from "../findings.js";
import { syntaxFindingOf } from "./syntax-finding.js";

export const depthLimit = 512;

export function tooDeepOf(): Finding {
  const limit = String(depthLimit);
  return syntaxFindingOf("tooDeep", [limit]);
}
