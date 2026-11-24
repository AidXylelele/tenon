export type Merged =
  | { readonly kind: "clean"; readonly text: string }
  | { readonly kind: "conflicting" };
