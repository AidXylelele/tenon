import { isAttributeName } from "../../runtime/index.js";
import { isExtensionAttribute } from "../../standard/index.js";
import type {
  EventProperties,
  Finding,
  Task,
  ValueTemplate,
} from "../../syntax/index.js";
import type { CheckSubject } from "./types.js";

type Member = readonly [name: string, value: ValueTemplate];

const none: readonly Member[] = [];

export function checkAttributeNames(subject: CheckSubject): readonly Finding[] {
  const tasks = subject.occurrences
    .filter((occurrence) => occurrence.kind === "task")
    .map((occurrence) => occurrence.task);
  const members = tasks.flatMap(emittedMembersOf);
  const misnamed = members.filter(isMisnamed);

  return misnamed.map(misnamedAttributeOf);
}

function emittedMembersOf(task: Task): readonly Member[] {
  switch (task.kind) {
    case "emit":
      return membersOf(task.event);
    case "call":
    case "do":
    case "for":
    case "fork":
    case "listen":
    case "raise":
    case "run":
    case "set":
    case "switch":
    case "try":
    case "wait":
      return none;
  }
}

function membersOf(event: EventProperties): readonly Member[] {
  return [...event.additional.entries()];
}

function isMisnamed([name]: Member): boolean {
  const isExtension = isExtensionAttribute(name);
  const isNamed = isAttributeName(name);

  return isExtension && !isNamed;
}

function misnamedAttributeOf([
  name,
  value,
]: Member): Finding<"misnamedAttribute"> {
  return {
    name: "misnamedAttribute",
    code: "event-attribute",
    pointer: value.pointer,
    subject: name,
    details: [name],
    import: null,
  };
}
