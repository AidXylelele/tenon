import type * as ast from "../../../syntax/index.js";
import {
  type ContainerTemplate,
  type EventualCleanup,
  type InlineCodeTemplate,
  type ResourceTemplate,
  type ScriptTemplate,
  type ShellTemplate,
  alwaysCleanup,
  containerTemplate,
  eventualCleanup,
  inlineCodeTemplate,
  neverCleanup,
  scriptTemplate,
  shellTemplate,
} from "../../forms/index.js";
import type { Context } from "../context.js";
import { durationOf } from "../durations.js";
import { optionalPartOf, templateOf, writtenTemplateOf } from "../templates.js";
import { resourceTemplateOf } from "./endpoints.js";
import { noEntries, noItems } from "./neutrals.js";

type HostProcess = ast.ContainerProcess | ast.ScriptProcess | ast.ShellProcess;

export function hostProcessOf(
  process: HostProcess,
  context: Context,
): ContainerTemplate | ScriptTemplate | ShellTemplate {
  switch (process.kind) {
    case "container":
      return containerTemplateOf(process, context);
    case "script":
      return scriptTemplateOf(process, context);
    case "shell":
      return shellTemplateOf(process, context);
  }
}

function containerTemplateOf(
  container: ast.ContainerProcess,
  context: Context,
): ContainerTemplate {
  const image = writtenTemplateOf(container.image, context);
  const name = optionalPartOf(container.name, context);
  const command = optionalPartOf(container.command, context);
  const ports = templateOf(container.ports, noEntries, context);
  const volumes = templateOf(container.volumes, noEntries, context);
  const environment = templateOf(container.environment, noEntries, context);
  const stdin = optionalPartOf(container.stdin, context);
  const commandArguments = templateOf(container.arguments, noItems, context);
  const lifetime = lifetimeOf(container.lifetime, context);

  return containerTemplate({
    image,
    name,
    command,
    ports,
    volumes,
    environment,
    stdin,
    arguments: commandArguments,
    lifetime,
    pullPolicy: container.pullPolicy,
  });
}

function lifetimeOf(
  lifetime: ast.ContainerLifetime,
  context: Context,
): ContainerTemplate["lifetime"] {
  switch (lifetime.kind) {
    case "always":
      return alwaysCleanup;
    case "never":
      return neverCleanup;
    case "eventually":
      return eventualCleanupOf(lifetime, context);
  }
}

function eventualCleanupOf(
  lifetime: ast.EventualCleanup,
  context: Context,
): EventualCleanup {
  const after = durationOf(lifetime.after, context);
  return eventualCleanup({ after });
}

function scriptTemplateOf(
  script: ast.ScriptProcess,
  context: Context,
): ScriptTemplate {
  const source = scriptSourceOf(script.source, context);
  const stdin = optionalPartOf(script.stdin, context);
  const scriptArguments = templateOf(script.arguments, noEntries, context);
  const environment = templateOf(script.environment, noEntries, context);

  return scriptTemplate({
    language: script.language,
    source,
    stdin,
    arguments: scriptArguments,
    environment,
  });
}

function scriptSourceOf(
  source: ast.InlineCode | ast.ExternalResource,
  context: Context,
): InlineCodeTemplate | ResourceTemplate {
  switch (source.kind) {
    case "inline":
      return inlineCodeTemplate({ code: source.code });
    case "external":
      return resourceTemplateOf(source, context);
  }
}

function shellTemplateOf(
  shell: ast.ShellProcess,
  context: Context,
): ShellTemplate {
  const command = writtenTemplateOf(shell.command, context);
  const stdin = optionalPartOf(shell.stdin, context);
  const commandArguments = templateOf(shell.arguments, noItems, context);
  const directory = optionalPartOf(shell.directory, context);
  const environment = templateOf(shell.environment, noEntries, context);

  return shellTemplate({
    command,
    stdin,
    arguments: commandArguments,
    directory,
    environment,
  });
}
