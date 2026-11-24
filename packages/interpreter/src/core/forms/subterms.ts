import type { Recovery } from "./handling.js";
import type { Extend, Term } from "./terms.js";

const none: readonly Term[] = [];

export function subtermsOf(term: Term): readonly Term[] {
  switch (term.form) {
    case "sequence":
      return term.steps;
    case "taskList":
      return term.tasks;
    case "task":
    case "let":
    case "guard":
    case "deadline":
    case "loop":
      return [term.body];
    case "handle":
      return [term.body, ...recoveredTermsOf(term.catch.recovery)];
    case "parallel":
      return term.branches;
    case "stream":
      return term.iterators.map((iterator) => iterator.each);
    case "extend":
      return extendedTermsOf(term);
    case "transform":
    case "validate":
    case "export":
    case "choose":
    case "perform":
    case "raise":
    case "invoke":
      return none;
  }
}

function recoveredTermsOf(recovery: Recovery): readonly Term[] {
  switch (recovery.kind) {
    case "recover":
      return [recovery.body];
    case "reraise":
      return none;
  }
}

function extendedTermsOf(term: Extend): readonly Term[] {
  const lists = term.extensions.flatMap((extension) => [
    ...extension.before,
    ...extension.after,
  ]);

  return [...lists, term.body, term.stages];
}
