import type {
  ContainerLifetime,
  ContainerProcess,
  ExternalResource,
  InlineCode,
  Process,
  ScriptProcess,
  ShellProcess,
} from "../../syntax/index.js";
import { durationOccurrencesOf, templateOccurrencesOf } from "./data.js";
import { resourceOccurrencesOf } from "./endpoints.js";
import type { Context, Occurrence } from "./types.js";

const none: readonly Occurrence[] = [];

export function processOccurrencesOf(
  process: Process,
  context: Context,
): readonly Occurrence[] {
  switch (process.kind) {
    case "container":
      return containerOccurrencesOf(process, context);
    case "script":
      return scriptOccurrencesOf(process, context);
    case "shell":
      return shellOccurrencesOf(process, context);
    case "workflow":
      return templateOccurrencesOf(process.input, context);
  }
}

function containerOccurrencesOf(
  container: ContainerProcess,
  context: Context,
): readonly Occurrence[] {
  return [
    ...templateOccurrencesOf(container.image, context),
    ...templateOccurrencesOf(container.name, context),
    ...templateOccurrencesOf(container.command, context),
    ...templateOccurrencesOf(container.ports, context),
    ...templateOccurrencesOf(container.volumes, context),
    ...templateOccurrencesOf(container.environment, context),
    ...templateOccurrencesOf(container.stdin, context),
    ...templateOccurrencesOf(container.arguments, context),
    ...lifetimeOccurrencesOf(container.lifetime, context),
  ];
}

function lifetimeOccurrencesOf(
  lifetime: ContainerLifetime,
  context: Context,
): readonly Occurrence[] {
  switch (lifetime.kind) {
    case "always":
    case "never":
      return none;
    case "eventually":
      return durationOccurrencesOf(lifetime.after, context);
  }
}

function scriptOccurrencesOf(
  script: ScriptProcess,
  context: Context,
): readonly Occurrence[] {
  return [
    ...sourceOccurrencesOf(script.source, context),
    ...templateOccurrencesOf(script.stdin, context),
    ...templateOccurrencesOf(script.arguments, context),
    ...templateOccurrencesOf(script.environment, context),
  ];
}

function sourceOccurrencesOf(
  source: InlineCode | ExternalResource,
  context: Context,
): readonly Occurrence[] {
  switch (source.kind) {
    case "inline":
      return none;
    case "external":
      return resourceOccurrencesOf(source, context);
  }
}

function shellOccurrencesOf(
  shell: ShellProcess,
  context: Context,
): readonly Occurrence[] {
  return [
    ...templateOccurrencesOf(shell.command, context),
    ...templateOccurrencesOf(shell.stdin, context),
    ...templateOccurrencesOf(shell.arguments, context),
    ...templateOccurrencesOf(shell.directory, context),
    ...templateOccurrencesOf(shell.environment, context),
  ];
}
