import type { EffectKind, Manifest } from "../../api/index.js";
import { type Context, schedulesOf } from "../desugar/index.js";
import {
  type ExportSchema,
  type Retry,
  type StreamSource,
  type Term,
  constantListOf,
} from "../forms/index.js";
import { identityOf } from "./identity.js";
import { routingFiltersOf } from "./routing.js";

const none: readonly EffectKind[] = [];

export function manifestOf(
  terms: readonly Term[],
  context: Context,
  patterns: ReadonlyMap<string, RegExp>,
): Manifest {
  const workflow = context.model.workflow;
  const identity = identityOf(workflow.document);
  const performed = terms.flatMap(effectsOf);
  const unique = [...new Set(performed)];
  const sorted = unique.toSorted();
  const effects = constantListOf(sorted);
  const names = workflow.use.secrets.map((secret) => secret.name);
  const secrets = constantListOf(names);
  const scheduled = schedulesOf(workflow.schedules, context);
  const schedules = constantListOf(scheduled);
  const filters = routingFiltersOf(terms, patterns);
  const manifest: Manifest = {
    identity,
    effects,
    secrets,
    schedules,
    filters,
  };

  return Object.freeze(manifest);
}

function effectsOf(term: Term): readonly EffectKind[] {
  switch (term.form) {
    case "perform":
      return [term.effect.kind];
    case "stream":
      return [streamEffectOf(term.source)];
    case "validate":
    case "export":
      return schemaEffectsOf(term.schema);
    case "handle":
      return retryEffectsOf(term.retry);
    case "sequence":
    case "taskList":
    case "task":
    case "let":
    case "guard":
    case "transform":
    case "choose":
    case "loop":
    case "raise":
    case "deadline":
    case "parallel":
    case "extend":
    case "invoke":
      return none;
  }
}

function streamEffectOf(source: StreamSource): EffectKind {
  switch (source.kind) {
    case "listen":
      return "listen";
    case "subscription":
      return "asyncapi";
  }
}

function schemaEffectsOf(schema: ExportSchema): readonly EffectKind[] {
  switch (schema.kind) {
    case "unchecked":
    case "compiled":
      return none;
    case "fetched":
      return [schema.resource.kind];
  }
}

function retryEffectsOf(retry: Retry): readonly EffectKind[] {
  switch (retry.kind) {
    case "never":
      return none;
    case "policy":
      return ["timer"];
  }
}
