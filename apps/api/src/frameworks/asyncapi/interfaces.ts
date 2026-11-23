import type { Parser } from "@asyncapi/parser";

export type ParserOptions = NonNullable<
  ConstructorParameters<typeof Parser>[0]
>;
