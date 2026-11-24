export type Result<T, F> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: F };
