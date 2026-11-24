export const defaultCatalog = "default";

export function catalogFunctionPathOf(name: string, version: string): string {
  return `functions/${name}/${version}/function.yaml`;
}
