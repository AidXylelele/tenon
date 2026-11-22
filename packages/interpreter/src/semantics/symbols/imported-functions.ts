import type { FunctionSymbol, ImportedFunction } from "./types.js";

export function importedFunctionOf(
  pointer: string,
  functions: ReadonlyMap<string, FunctionSymbol>,
): ImportedFunction | null {
  const symbols = [...functions.values()];
  const imported = symbols.filter((symbol) => symbol.origin === "imported");
  const holder = imported.find(({ task }) => isWithin(pointer, task.pointer));

  return holder ?? null;
}

function isWithin(pointer: string, root: string): boolean {
  return pointer === root || pointer.startsWith(`${root}/`);
}
