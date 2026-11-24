import { type Procedure, type Term, subtermsOf } from "../forms/index.js";
import type { Extending } from "./context.js";

const separator = ":";

const noProcedures: ReadonlyMap<string, Procedure> = new Map();

export function procedureKeyOf(name: string, extending: Extending): string {
  return `${extending}${separator}${name}`;
}

export function proceduresOf(
  roots: readonly Term[],
): ReadonlyMap<string, Procedure> {
  return closureOf(roots, noProcedures);
}

function closureOf(
  terms: readonly Term[],
  known: ReadonlyMap<string, Procedure>,
): ReadonlyMap<string, Procedure> {
  const called = calledOf(terms);
  const fresh = called.filter((procedure) => !known.has(procedure.key));

  if (fresh.length === 0) {
    return known;
  }

  const entries = fresh.map((procedure) => [procedure.key, procedure] as const);
  const procedureEntries = [...known, ...entries];
  const procedures = new Map(procedureEntries);
  const bodies = fresh.map((procedure) => procedure.body);

  return closureOf(bodies, procedures);
}

function calledOf(terms: readonly Term[]): readonly Procedure[] {
  const callees = terms.flatMap(calleesOf);
  const unique = new Set(callees);

  return [...unique];
}

function calleesOf(term: Term): readonly Procedure[] {
  if (term.form === "invoke") {
    return [term.callee];
  }

  const held = subtermsOf(term);
  return held.flatMap(calleesOf);
}
