import type { AuthenticationScheme } from "../../api/index.js";
import type { Call, Finding, GrpcCall, Task } from "../../syntax/index.js";
import type { ReferenceTable } from "../symbols/index.js";
import { missingCapabilityOf } from "./capabilities.js";
import { policyOf, schemeOf } from "./policies.js";
import type { Requirement } from "./requirements.js";
import type { CheckSubject } from "./types.js";

const challenged: AuthenticationScheme = "digest";

const none: readonly Requirement[] = [];

export function checkGrpcAuthentication(
  subject: CheckSubject,
): readonly Finding[] {
  const references = subject.symbols.references;
  const tasks = subject.occurrences
    .filter((occurrence) => occurrence.kind === "task")
    .map((occurrence) => occurrence.task);
  const challenges = tasks.flatMap((task) => challengesOf(task, references));

  return challenges.map(missingCapabilityOf);
}

function challengesOf(
  task: Task,
  references: ReferenceTable,
): readonly Requirement[] {
  switch (task.kind) {
    case "call":
      return callChallengesOf(task.call, task.pointer, references);
    case "do":
    case "emit":
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

function callChallengesOf(
  call: Call,
  pointer: string,
  references: ReferenceTable,
): readonly Requirement[] {
  switch (call.kind) {
    case "grpc":
      return serviceChallengesOf(call, pointer, references);
    case "asyncapi":
    case "http":
    case "openapi":
    case "a2a":
    case "mcp":
    case "function":
      return none;
  }
}

function serviceChallengesOf(
  call: GrpcCall,
  pointer: string,
  references: ReferenceTable,
): readonly Requirement[] {
  const authentication = call.service.authentication;
  const policy = policyOf(authentication, references);

  if (policy === null) {
    return none;
  }

  const scheme = schemeOf(policy);

  if (scheme !== challenged) {
    return none;
  }

  return [{ kind: "authentication", name: challenged, pointer }];
}
