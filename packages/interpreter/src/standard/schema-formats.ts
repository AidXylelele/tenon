import { defaults } from "./defaults.js";

export function isJsonSchemaFormat(format: string): boolean {
  const json = defaults.schemaFormat;
  return format === json || format.startsWith(`${json}:`);
}
