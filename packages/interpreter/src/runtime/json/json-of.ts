import type { JsonValue } from "../../api/index.js";

export type JsonOf<T> = T extends JsonValue
  ? T
  : T extends readonly (infer Item)[]
    ? readonly JsonOf<Item>[]
    : T extends (...parameters: never[]) => unknown
      ? never
      : T extends object
        ? { readonly [Key in keyof T]: JsonOf<T[Key]> }
        : never;
