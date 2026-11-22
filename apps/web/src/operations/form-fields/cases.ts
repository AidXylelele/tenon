import type { EditAction, FormField } from "language-server/protocol";
import type { CaseRow, FieldState } from "./interfaces";
import { memberPointerOf } from "./values";

type Json = FormField["value"];

type JsonObject = { readonly [key: string]: Json };

const CONTINUE = "continue";

const BRANCH = "branch";

const OTHERWISE = "default";

export function casesOf(value: Json): readonly CaseRow[] | null {
  if (!Array.isArray(value)) return null;

  const rows = value.map(caseOf);
  const isRead = rows.every((row) => row !== null);

  return isRead ? rows : null;
}

function caseOf(item: Json, index: number): CaseRow | null {
  if (!isObject(item)) return null;

  const [entry, ...others] = Object.entries(item);

  if (entry === undefined || others.length > 0) return null;

  const [name, body] = entry;

  if (!isObject(body)) return null;

  const when = typeof body.when === "string" ? body.when : null;
  const then = typeof body.then === "string" ? body.then : CONTINUE;
  const isOtherwise = !("when" in body);

  return { index, name, when, then, isOtherwise };
}

export function whenPointerOf(holder: string, row: CaseRow): string {
  const item = `${holder}/${String(row.index)}`;
  const body = memberPointerOf(item, row.name);
  return `${body}/when`;
}

export function thenEditsOf(
  holder: FieldState,
  row: CaseRow,
  then: string,
): EditAction[] {
  if (then === row.then) return [];

  const item = `${holder.pointer}/${String(row.index)}`;
  const body = memberPointerOf(item, row.name);
  const pointer = `${body}/then`;
  return [{ kind: "setField", pointer, value: then }];
}

export function otherwiseEditsOf(
  holder: FieldState,
  then: string,
): EditAction[] {
  const items = itemsOf(holder.value);
  const rows = casesOf(holder.value) ?? [];
  const otherwise = rows.find((row) => row.isOtherwise);

  if (otherwise !== undefined) return thenEditsOf(holder, otherwise, then);

  if (then === CONTINUE) return [];

  const added = { [OTHERWISE]: { then } };
  const value = items.concat([added]);
  return [{ kind: "setField", pointer: holder.pointer, value }];
}

export function caseAdditionOf(holder: FieldState): EditAction[] {
  const items = itemsOf(holder.value);
  const rows = casesOf(holder.value) ?? [];
  const names = new Set(rows.map((row) => row.name));
  const name = freeBranchOf(names);
  const added = { [name]: { when: "", then: CONTINUE } };
  const otherwise = rows.findIndex((row) => row.isOtherwise);
  const at = otherwise === -1 ? items.length : otherwise;
  const before = items.slice(0, at);
  const after = items.slice(at);
  const value = before.concat([added], after);
  return [{ kind: "setField", pointer: holder.pointer, value }];
}

function freeBranchOf(names: ReadonlySet<string>): string {
  const candidates = Array.from(
    { length: names.size + 1 },
    (_, index) => `${BRANCH}-${String(index + 1)}`,
  );
  const free = candidates.find((name) => !names.has(name));

  return free ?? BRANCH;
}

export function caseMoveOf(
  holder: FieldState,
  row: CaseRow,
  by: -1 | 1,
): EditAction[] {
  const items = itemsOf(holder.value);
  const target = row.index + by;
  const moved = items[row.index];
  const swapped = items[target];

  if (moved === undefined || swapped === undefined) return [];

  const value = items.map((item, index) => {
    if (index === row.index) return swapped;

    if (index === target) return moved;

    return item;
  });
  return [{ kind: "setField", pointer: holder.pointer, value }];
}

export function caseRemovalOf(holder: FieldState, row: CaseRow): EditAction[] {
  const items = itemsOf(holder.value);
  const value = items.filter((_, index) => index !== row.index);
  return [{ kind: "setField", pointer: holder.pointer, value }];
}

function itemsOf(value: Json): readonly Json[] {
  return Array.isArray(value) ? value : [];
}

function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
