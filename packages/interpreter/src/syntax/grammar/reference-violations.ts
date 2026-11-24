import type { JsonObject, JsonValue } from "../../api/index.js";
import { isJsonArray, isJsonObject } from "../../runtime/index.js";
import {
  type CallProtocol,
  isMemberOf,
  scriptLanguages,
} from "../../standard/index.js";
import type { RuleBreach } from "./types.js";

const none: readonly RuleBreach[] = [];

const unnamedAgent: readonly RuleBreach[] = [
  {
    kind: "rule",
    pointer: "/with",
    instance: "/with",
    keyword: "required",
    rule: "unnamedAgent",
  },
];

const eventWithoutProperties: readonly RuleBreach[] = [
  {
    kind: "rule",
    pointer: "/emit/event",
    instance: "/emit/event",
    keyword: "required",
    rule: "eventWithoutProperties",
  },
];

const unsupportedLanguage: readonly RuleBreach[] = [
  {
    kind: "rule",
    pointer: "/run/script/language",
    instance: "/run/script/language",
    keyword: "enum",
    rule: "unsupportedLanguage",
  },
];

const competitionWithoutBranches: readonly RuleBreach[] = [
  {
    kind: "rule",
    pointer: "/fork/branches",
    instance: "/fork/branches",
    keyword: "minItems",
    rule: "competitionWithoutBranches",
  },
];

export function referenceViolationsOf(task: JsonValue): readonly RuleBreach[] {
  const isTask = isJsonObject(task);

  if (!isTask) {
    return none;
  }

  if (task.call === ("a2a" satisfies CallProtocol)) {
    const a2aArguments = task.with ?? null;
    return agentViolationsOf(a2aArguments);
  }

  const emit = task.emit ?? null;
  const isEmit = isJsonObject(emit);

  if (isEmit) {
    return eventViolationsOf(emit);
  }

  const run = task.run ?? null;
  const isRun = isJsonObject(run);

  if (isRun) {
    return scriptViolationsOf(run);
  }

  const fork = task.fork ?? null;
  const isFork = isJsonObject(fork);

  if (isFork) {
    return competitionViolationsOf(fork);
  }

  return none;
}

function agentViolationsOf(a2aArguments: JsonValue): readonly RuleBreach[] {
  const named =
    !isJsonObject(a2aArguments) ||
    "agentCard" in a2aArguments ||
    "server" in a2aArguments;
  return named ? none : unnamedAgent;
}

function eventViolationsOf(emit: JsonObject): readonly RuleBreach[] {
  const event = emit.event ?? null;
  const written = !isJsonObject(event) || "with" in event;

  return written ? none : eventWithoutProperties;
}

function scriptViolationsOf(run: JsonObject): readonly RuleBreach[] {
  const script = run.script ?? null;
  const isScript = isJsonObject(script);
  const language = isScript ? script.language : null;
  const supported =
    typeof language !== "string" || isMemberOf(scriptLanguages, language);

  return supported ? none : unsupportedLanguage;
}

function competitionViolationsOf(fork: JsonObject): readonly RuleBreach[] {
  const branches = fork.branches ?? null;
  const empty = isJsonArray(branches) && branches.length === 0;
  const competesAmongNone = fork.compete === true && empty;

  return competesAmongNone ? competitionWithoutBranches : none;
}
