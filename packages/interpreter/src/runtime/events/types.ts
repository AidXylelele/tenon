import type { JsonValue } from "../../api/index.js";

export type Attribute =
  | { readonly kind: "present"; readonly value: JsonValue }
  | { readonly kind: "absent" };
