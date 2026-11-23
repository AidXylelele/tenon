import type { EditAction } from "language-server/protocol";
import type { Commit, FieldState, ValueRow } from "./interfaces";
import { isObject, type Json, type JsonObject } from "./json";

const FIRST_NAME = "value";

export function rowsOf(value: Json): readonly ValueRow[] | null {
  if (value === null) return [];

  if (!isObject(value)) return null;

  return Object.entries(value).map(([name, held]) => ({ name, value: held }));
}

export function memberPointerOf(holder: string, name: string): string {
  const escaped = name.replaceAll("~", "~0").replaceAll("/", "~1");
  return `${holder}/${escaped}`;
}

export function renameCommitOf(
  holder: FieldState,
  from: string,
  to: string,
): Commit {
  const name = to.trim();
  const members = membersOf(holder.value);

  if (name === from) return { kind: "edits", edits: [] };

  if (name === "") return { kind: "refused", reason: "Give the value a name." };

  if (name in members)
    return {
      kind: "refused",
      reason: `Another value is already named “${name}”.`,
    };

  const entries = Object.entries(members).map(([key, value]) => {
    const renamed = key === from ? name : key;
    return [renamed, value] as const;
  });
  const value = Object.fromEntries(entries);
  const edits = setOf(holder, value);
  return { kind: "edits", edits };
}

export function removalOf(holder: FieldState, name: string): EditAction[] {
  const members = membersOf(holder.value);
  const kept = Object.entries(members).filter(([key]) => key !== name);
  const value = Object.fromEntries(kept);
  return setOf(holder, value);
}

export function additionOf(holder: FieldState): EditAction[] {
  const members = membersOf(holder.value);
  const name = freeNameOf(members);
  const value = { ...members, [name]: "" };
  return setOf(holder, value);
}

function freeNameOf(members: JsonObject): string {
  const taken = Object.keys(members).length;
  const candidates = Array.from({ length: taken + 1 }, (_, index) =>
    index === 0 ? FIRST_NAME : `${FIRST_NAME}-${String(index + 1)}`,
  );
  const free = candidates.find((name) => !(name in members));

  return free ?? FIRST_NAME;
}

function membersOf(value: Json): JsonObject {
  return isObject(value) ? value : {};
}

function setOf(holder: FieldState, value: JsonObject): EditAction[] {
  return [{ kind: "setField", pointer: holder.pointer, value }];
}
