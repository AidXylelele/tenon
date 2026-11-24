import { extensionTargets } from "../../standard/index.js";
import type { Catalog, Extension, Secret, Use } from "../ast/index.js";
import { authenticationOf } from "./authentications.js";
import { endpointOf } from "./endpoints.js";
import {
  errorDefinitionOf,
  retryPolicyOf,
  timeoutDefinitionOf,
} from "./errors.js";
import {
  listAt,
  mapAt,
  objectFieldOf,
  optionalAt,
  requiredAt,
  soleFieldOf,
} from "./parts.js";
import { requiredMemberAt, textOf } from "./scalars.js";
import { taskListOf, taskOf } from "./tasks.js";
import type { Part } from "./types.js";
import { expressionOf } from "./values.js";

export function useOf(workflow: Part): Use {
  const use = objectFieldOf(workflow, "use");
  const authentications = mapAt(use, "authentications", authenticationOf);
  const catalogs = mapAt(use, "catalogs", catalogOf);
  const errors = mapAt(use, "errors", errorDefinitionOf);
  const extensions = listAt(use, "extensions").map(extensionOf);
  const functions = mapAt(use, "functions", taskOf);
  const retries = mapAt(use, "retries", retryPolicyOf);
  const secrets = listAt(use, "secrets").map(secretOf);
  const timeouts = mapAt(use, "timeouts", timeoutDefinitionOf);

  return {
    pointer: use.pointer,
    authentications,
    catalogs,
    errors,
    extensions,
    functions,
    retries,
    secrets,
    timeouts,
  };
}

function catalogOf(part: Part): Catalog {
  const endpoint = requiredAt(part, "endpoint", endpointOf);
  return { pointer: part.pointer, endpoint };
}

function extensionOf(item: Part): Extension {
  const { part } = soleFieldOf(item);
  const extend = requiredMemberAt(part, "extend", extensionTargets);
  const when = optionalAt(part, "when", expressionOf);
  const before = optionalAt(part, "before", taskListOf);
  const after = optionalAt(part, "after", taskListOf);

  return { pointer: part.pointer, extend, when, before, after };
}

function secretOf(part: Part): Secret {
  const name = textOf(part);
  return { pointer: part.pointer, name };
}
