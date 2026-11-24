import {
  cleanupPolicies,
  defaults,
  processKinds,
  pullPolicies,
  scriptLanguages,
} from "../../standard/index.js";
import type {
  ContainerLifetime,
  ContainerProcess,
  ExternalResource,
  InlineCode,
  Process,
  ScriptProcess,
  ShellProcess,
  WorkflowProcess,
} from "../ast/index.js";
import { durationOf } from "./durations.js";
import { externalResourceOf } from "./endpoints.js";
import {
  fieldOf,
  objectFieldOf,
  optionalAt,
  requiredAt,
  requiredFieldOf,
} from "./parts.js";
import {
  keyOf,
  optionalMemberAt,
  requiredMemberAt,
  textOf,
} from "./scalars.js";
import type { Part } from "./types.js";
import { textTemplateOf, valueTemplateOf } from "./values.js";

export function processOf(run: Part): Process {
  const kind = keyOf(run, processKinds);
  const process = requiredFieldOf(run, kind);

  switch (kind) {
    case "container":
      return containerOf(process);
    case "script":
      return scriptOf(process);
    case "shell":
      return shellOf(process);
    case "workflow":
      return workflowOf(process);
  }
}

function containerOf(part: Part): ContainerProcess {
  const image = requiredAt(part, "image", textTemplateOf);
  const name = optionalAt(part, "name", textTemplateOf);
  const command = optionalAt(part, "command", textTemplateOf);
  const ports = optionalAt(part, "ports", valueTemplateOf);
  const volumes = optionalAt(part, "volumes", valueTemplateOf);
  const environment = optionalAt(part, "environment", valueTemplateOf);
  const stdin = optionalAt(part, "stdin", textTemplateOf);
  const parameters = optionalAt(part, "arguments", valueTemplateOf);
  const lifetime = lifetimeOf(part);
  const pullPolicy =
    optionalMemberAt(part, "pullPolicy", pullPolicies) ??
    defaults.containerPullPolicy;

  return {
    kind: "container",
    pointer: part.pointer,
    image,
    name,
    command,
    ports,
    volumes,
    environment,
    stdin,
    arguments: parameters,
    lifetime,
    pullPolicy,
  };
}

function lifetimeOf(container: Part): ContainerLifetime {
  const lifetime = objectFieldOf(container, "lifetime");
  const cleanup =
    optionalMemberAt(lifetime, "cleanup", cleanupPolicies) ??
    defaults.containerCleanup;

  switch (cleanup) {
    case "always":
    case "never":
      return { kind: cleanup, pointer: lifetime.pointer };
    case "eventually": {
      const after = requiredAt(lifetime, "after", durationOf);
      return { kind: cleanup, pointer: lifetime.pointer, after };
    }
  }
}

function scriptOf(part: Part): ScriptProcess {
  const language = requiredMemberAt(part, "language", scriptLanguages);
  const source = sourceOf(part);
  const stdin = optionalAt(part, "stdin", textTemplateOf);
  const parameters = optionalAt(part, "arguments", valueTemplateOf);
  const environment = optionalAt(part, "environment", valueTemplateOf);

  return {
    kind: "script",
    pointer: part.pointer,
    language,
    source,
    stdin,
    arguments: parameters,
    environment,
  };
}

function sourceOf(script: Part): InlineCode | ExternalResource {
  const code = fieldOf(script, "code");

  if (code === null) {
    return requiredAt(script, "source", externalResourceOf);
  }

  const text = textOf(code);
  return { kind: "inline", pointer: code.pointer, code: text };
}

function shellOf(part: Part): ShellProcess {
  const command = requiredAt(part, "command", textTemplateOf);
  const stdin = optionalAt(part, "stdin", textTemplateOf);
  const parameters = optionalAt(part, "arguments", valueTemplateOf);
  const directory = optionalAt(part, "directory", textTemplateOf);
  const environment = optionalAt(part, "environment", valueTemplateOf);

  return {
    kind: "shell",
    pointer: part.pointer,
    command,
    stdin,
    arguments: parameters,
    directory,
    environment,
  };
}

function workflowOf(part: Part): WorkflowProcess {
  const namespace = requiredAt(part, "namespace", textOf);
  const name = requiredAt(part, "name", textOf);
  const version =
    optionalAt(part, "version", textOf) ?? defaults.workflowProcessVersion;
  const input = optionalAt(part, "input", valueTemplateOf);

  return {
    kind: "workflow",
    pointer: part.pointer,
    namespace,
    name,
    version,
    input,
  };
}
