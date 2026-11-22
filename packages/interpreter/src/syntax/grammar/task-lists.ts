import type { JsonObject, JsonValue } from "../../api/index.js";
import { isJsonObject } from "../../runtime/index.js";
import {
  type CallProtocol,
  taskKinds,
  type TaskKind,
} from "../../standard/index.js";

const subscriptionList = "/with/subscription/foreach/do";

export function kindOf(task: object): TaskKind | null {
  const others = taskKinds.filter((candidate) => candidate !== "do");
  const doLast = [...others, "do"] as const;
  const kind = doLast.find((candidate) => Object.hasOwn(task, candidate));
  return kind ?? null;
}

export function nestedListsOf(task: JsonValue): readonly string[] {
  const isTask = isJsonObject(task);

  if (!isTask) {
    return [];
  }

  const kind = kindOf(task);

  switch (kind) {
    case "call":
      return subscriptionListsOf(task);
    case "for":
    case "do":
      return ["/do"];
    case "fork":
      return ["/fork/branches"];
    case "listen":
      return ["/foreach/do"];
    case "try":
      return ["/try", "/catch/do"];
    case "emit":
    case "raise":
    case "run":
    case "set":
    case "switch":
    case "wait":
    case null:
      return [];
  }
}

function subscriptionListsOf(task: JsonObject): readonly string[] {
  const isAsyncApi = task.call === ("asyncapi" satisfies CallProtocol);

  if (!isAsyncApi) {
    return [];
  }

  return [subscriptionList];
}
