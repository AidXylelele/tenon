export type Role =
  | "workflow"
  | "task"
  | "task-input"
  | "guard"
  | "timeout"
  | "input-schema"
  | "input-from"
  | "input"
  | "input-stages"
  | "run"
  | "extend"
  | "task-output"
  | "output-as"
  | "output"
  | "output-schema"
  | "export"
  | "output-stages"
  | "export-stages"
  | "body"
  | "list"
  | "loop"
  | "choose"
  | "parallel"
  | "handle"
  | "recovery"
  | "raise"
  | "perform"
  | "stream"
  | "item-stages"
  | "invoke"
  | "initial-context";

export type TermId = string;

export function termIdOf(site: string, role: Role): TermId {
  return `${site}|${role}`;
}
