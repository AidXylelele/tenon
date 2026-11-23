import type { ParserOptions } from "./interfaces.js";

const REFUSED_REFERENCE = '{"$external-references-are-not-read": true}';

const refused = ["file", "http", "https"].map((schema) => ({
  schema,
  order: 1,
  read: () => REFUSED_REFERENCE,
}));

export const parserOptions: ParserOptions = {
  __unstable: { resolver: { resolvers: refused } },
};
