import { type Term, subtermsOf } from "../forms/index.js";

export function termsOf(term: Term): readonly Term[] {
  const held = subtermsOf(term);
  const inner = held.flatMap(termsOf);

  return [term, ...inner];
}

export function programTermsOf(roots: readonly Term[]): readonly Term[] {
  const terms = roots.flatMap(termsOf);
  const unique = new Set(terms);

  return [...unique];
}
