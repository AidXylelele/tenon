// An expected failure is a value the caller handles; an exception means a bug.
export type Result<T, F> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: F };
