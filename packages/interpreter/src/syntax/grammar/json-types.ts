export const jsonTypes = [
  "object",
  "array",
  "string",
  "number",
  "integer",
  "boolean",
  "null",
] as const;
export type JsonType = (typeof jsonTypes)[number];
