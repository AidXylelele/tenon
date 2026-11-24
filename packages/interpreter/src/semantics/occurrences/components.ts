import type { Catalog, Extension, Task, Use } from "../../syntax/index.js";
import { at, declaring, inFunction, outermost } from "./contexts.js";
import { templateOccurrencesOf } from "./data.js";
import {
  authenticationOccurrencesOf,
  endpointOccurrencesOf,
} from "./endpoints.js";
import {
  declaredRetryOccurrencesOf,
  errorOccurrencesOf,
  timeoutOccurrencesOf,
} from "./errors.js";
import { taskListOccurrencesOf, taskOccurrencesOf } from "./tasks.js";
import type { NamedComponent, Occurrence, Position, Walk } from "./types.js";

export function useOccurrencesOf(use: Use): readonly Occurrence[] {
  return [
    ...declaredOccurrencesOf(
      use.authentications,
      "authenticationComponent",
      authenticationOccurrencesOf,
    ),
    ...catalogsOccurrencesOf(use.catalogs),
    ...declaredOccurrencesOf(use.errors, "errorComponent", errorOccurrencesOf),
    ...declaredOccurrencesOf(
      use.retries,
      "retryComponent",
      declaredRetryOccurrencesOf,
    ),
    ...declaredOccurrencesOf(
      use.timeouts,
      "timeoutComponent",
      timeoutOccurrencesOf,
    ),
    ...use.extensions.flatMap(extensionOccurrencesOf),
    ...functionsOccurrencesOf(use.functions),
  ];
}

export function functionOccurrencesOf(
  task: Task,
  name: string,
): readonly Occurrence[] {
  const context = inFunction(outermost, name);
  return taskOccurrencesOf(task, context);
}

function declaredOccurrencesOf<Component extends NamedComponent>(
  components: ReadonlyMap<string, Component>,
  position: Position,
  walk: Walk<Component>,
): readonly Occurrence[] {
  const declared = [...components.values()];
  const kind = at(outermost, position);

  return declared.flatMap((component) => {
    const context = declaring(kind, component);
    return walk(component, context);
  });
}

function catalogsOccurrencesOf(
  catalogs: ReadonlyMap<string, Catalog>,
): readonly Occurrence[] {
  const declared = [...catalogs.values()];
  const context = at(outermost, "catalogComponent");

  return declared.flatMap((catalog) =>
    endpointOccurrencesOf(catalog.endpoint, context),
  );
}

function extensionOccurrencesOf(extension: Extension): readonly Occurrence[] {
  const condition = at(outermost, "extensionWhen");

  return [
    ...templateOccurrencesOf(extension.when, condition),
    ...taskListOccurrencesOf(extension.before, "sequence", outermost),
    ...taskListOccurrencesOf(extension.after, "sequence", outermost),
  ];
}

function functionsOccurrencesOf(
  functions: ReadonlyMap<string, Task>,
): readonly Occurrence[] {
  const declared = [...functions];
  return declared.flatMap(([name, task]) => functionOccurrencesOf(task, name));
}
