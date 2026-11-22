import { derivedUuidOf } from "../../runtime/index.js";
import { type PrintedProgram, printProgram } from "../print/index.js";
import type { ProgramSource } from "./types.js";

const programIdentity = "interpreter-program";

export function fingerprintOf(
  program: PrintedProgram,
  source: ProgramSource,
  version: number,
): string {
  const printed = printProgram(program);
  // In code-unit order: another order would change every fingerprint.
  const keys = [...source.imported.keys()].toSorted();
  const imported = keys.map((key) => [key, source.imported.get(key)] as const);
  const identity = [version, source.document, imported, printed];
  const text = JSON.stringify(identity);

  return derivedUuidOf(programIdentity, text);
}
