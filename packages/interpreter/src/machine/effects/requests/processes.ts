import type {
  Container,
  ProcessRequest,
  Resource,
  Script,
  Shell,
} from "../../../api/index.js";
import type {
  ContainerTemplate,
  ProcessTemplate,
  ScriptTemplate,
  ShellTemplate,
} from "../../../core/index.js";
import { requestLengthOf } from "../../values/index.js";
import { resourceOf } from "./endpoints.js";
import type { Building } from "./building.js";
import {
  argumentTextsOf,
  entriesOf,
  environmentOf,
  optionalTextOf,
  stdinOf,
  textOf,
} from "./shapes.js";

export function processRequestOf(
  run: ProcessTemplate,
  building: Building,
): ProcessRequest {
  const process = hostProcessOf(run.process, building);
  return { kind: "process", process, await: run.await };
}

function hostProcessOf(
  process: ProcessTemplate["process"],
  building: Building,
): ProcessRequest["process"] {
  switch (process.kind) {
    case "container":
      return containerOf(process, building);
    case "script":
      return scriptOf(process, building);
    case "shell":
      return shellOf(process, building);
  }
}

function containerOf(
  container: ContainerTemplate,
  building: Building,
): Container {
  const image = textOf(container.image, building);
  const command = optionalTextOf(container.command, building);
  const stdin = stdinOf(container.stdin, building);
  const commandArguments = argumentTextsOf(container.arguments, building);
  const name = optionalTextOf(container.name, building);
  const ports = entriesOf(container.ports, building);
  const volumes = entriesOf(container.volumes, building);
  const environment = environmentOf(container.environment, building);
  const lifetime = lifetimeOf(container.lifetime, building);

  return {
    kind: "container",
    image,
    command,
    stdin,
    arguments: commandArguments,
    name,
    ports,
    volumes,
    environment,
    lifetime,
    pullPolicy: container.pullPolicy,
  };
}

function lifetimeOf(
  lifetime: ContainerTemplate["lifetime"],
  building: Building,
): Container["lifetime"] {
  switch (lifetime.kind) {
    case "always":
    case "never":
      return { cleanup: lifetime.kind, after: null };
    case "eventually": {
      const after = requestLengthOf(lifetime.after, building.values);
      return { cleanup: lifetime.kind, after };
    }
  }
}

function scriptOf(script: ScriptTemplate, building: Building): Script {
  const code = codeOf(script.source);
  const source = scriptResourceOf(script.source, building);
  const stdin = stdinOf(script.stdin, building);
  const scriptArguments = entriesOf(script.arguments, building);
  const environment = environmentOf(script.environment, building);

  return {
    kind: "script",
    language: script.language,
    code,
    source,
    stdin,
    arguments: scriptArguments,
    environment,
  };
}

function codeOf(source: ScriptTemplate["source"]): string | null {
  switch (source.kind) {
    case "inline":
      return source.code;
    case "resource":
      return null;
  }
}

function scriptResourceOf(
  source: ScriptTemplate["source"],
  building: Building,
): Resource | null {
  switch (source.kind) {
    case "inline":
      return null;
    case "resource":
      return resourceOf(source, building);
  }
}

function shellOf(shell: ShellTemplate, building: Building): Shell {
  const command = textOf(shell.command, building);
  const stdin = stdinOf(shell.stdin, building);
  const commandArguments = argumentTextsOf(shell.arguments, building);
  const directory = optionalTextOf(shell.directory, building);
  const environment = environmentOf(shell.environment, building);

  return {
    kind: "shell",
    command,
    stdin,
    arguments: commandArguments,
    directory,
    environment,
  };
}
