import { isPointerWithin } from "../../runtime/index.js";
import type { FunctionSymbol, ImportedFunction } from "./types.js";

export function importedFunctionOf(
  pointer: string,
  functions: ReadonlyMap<string, FunctionSymbol>,
): ImportedFunction | null {
  const symbols = [...functions.values()];
  const imported = symbols.filter((symbol) => symbol.origin === "imported");
  const holder = imported.find(({ task }) =>
    isPointerWithin(pointer, task.pointer),
  );

  return holder ?? null;
}
