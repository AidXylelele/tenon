export type WritePrecondition =
  | { readonly kind: "create" }
  | { readonly kind: "match"; readonly revision: string }
  | { readonly kind: "required" };
