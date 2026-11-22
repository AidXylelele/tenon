import type { Finding } from "../../syntax/index.js";
import type { BinderBinding } from "../occurrences/index.js";
import type { CheckSubject } from "./types.js";

export function checkBinders(subject: CheckSubject): readonly Finding[] {
  const declared = subject.occurrences
    .filter((occurrence) => occurrence.kind === "binders")
    .map((occurrence) => occurrence.binders);
  const repeated = declared.flatMap(repeatedBindersOf);

  return repeated.map(duplicateBinderOf);
}

function repeatedBindersOf(
  binders: readonly BinderBinding[],
): readonly BinderBinding[] {
  const names = binders.map(({ name }) => name);
  return binders.filter(({ name }, index) => names.indexOf(name) !== index);
}

function duplicateBinderOf(binder: BinderBinding): Finding<"duplicateBinder"> {
  const variable = `$${binder.name}`;

  return {
    name: "duplicateBinder",
    code: "schema",
    pointer: binder.declaration,
    subject: variable,
    details: [variable],
    import: null,
  };
}
