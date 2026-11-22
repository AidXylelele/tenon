import type { Finding, SwitchCase, Task } from "../../syntax/index.js";
import type { CheckSubject } from "./types.js";

const noCases: readonly SwitchCase[] = [];

export function checkDuplicateDefaults(
  subject: CheckSubject,
): readonly Finding[] {
  const tasks = subject.occurrences
    .filter((occurrence) => occurrence.kind === "task")
    .map((occurrence) => occurrence.task);
  const repeated = tasks.flatMap(repeatedDefaultsOf);

  return repeated.map(duplicateDefaultOf);
}

function repeatedDefaultsOf(task: Task): readonly SwitchCase[] {
  switch (task.kind) {
    case "switch":
      return repeatedOf(task.switch);
    case "call":
    case "do":
    case "emit":
    case "for":
    case "fork":
    case "listen":
    case "raise":
    case "run":
    case "set":
    case "try":
    case "wait":
      return noCases;
  }
}

function repeatedOf(cases: readonly SwitchCase[]): readonly SwitchCase[] {
  const defaults = cases.filter(({ when }) => when === null);
  return defaults.slice(1);
}

function duplicateDefaultOf(repeated: SwitchCase): Finding<"duplicateDefault"> {
  return {
    name: "duplicateDefault",
    code: "duplicate-default",
    pointer: repeated.pointer,
    subject: null,
    details: [],
    import: null,
  };
}
