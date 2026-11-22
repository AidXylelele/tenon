import type {
  Choose,
  Export,
  ExportSchema,
  Expression,
  Extend,
  Handle,
  Loop,
  Stream,
  Term,
} from "../../forms/index.js";
import { effectExpressionsOf, resourceExpressionsOf } from "./effects.js";
import { catchExpressionsOf, retryExpressionsOf } from "./handling.js";
import { sourceExpressionsOf, stopExpressionsOf } from "./streams.js";
import { durationExpressionsOf, templatesExpressionsOf } from "./values.js";

const none: readonly Expression[] = [];

export function heldExpressionsOf(term: Term): readonly Expression[] {
  switch (term.form) {
    case "sequence":
      return none;
    case "taskList":
      return none;
    case "task":
      return none;
    case "let":
      return none;
    case "guard":
      return term.conditions;
    case "transform":
      return templatesExpressionsOf([term.value]);
    case "validate":
      return schemaExpressionsOf(term.schema);
    case "export":
      return exportExpressionsOf(term);
    case "choose":
      return choiceExpressionsOf(term);
    case "loop":
      return loopExpressionsOf(term);
    case "perform":
      return effectExpressionsOf(term.effect);
    case "raise":
      return templatesExpressionsOf([term.error]);
    case "handle":
      return handlerExpressionsOf(term);
    case "deadline":
      return durationExpressionsOf(term.duration);
    case "parallel":
      return none;
    case "stream":
      return streamExpressionsOf(term);
    case "extend":
      return extensionExpressionsOf(term);
    case "invoke":
      return templatesExpressionsOf([term.arguments]);
  }
}

function exportExpressionsOf(exported: Export): readonly Expression[] {
  const value = templatesExpressionsOf([exported.value]);
  const schema = schemaExpressionsOf(exported.schema);

  return [...value, ...schema];
}

function schemaExpressionsOf(schema: ExportSchema): readonly Expression[] {
  switch (schema.kind) {
    case "unchecked":
    case "compiled":
      return none;
    case "fetched":
      return resourceExpressionsOf(schema.resource);
  }
}

function choiceExpressionsOf(choose: Choose): readonly Expression[] {
  return choose.cases.flatMap((chosen) => chosen.conditions);
}

function loopExpressionsOf(loop: Loop): readonly Expression[] {
  const items = templatesExpressionsOf([loop.items]);
  return [...items, ...loop.conditions];
}

function handlerExpressionsOf(handle: Handle): readonly Expression[] {
  const tests = catchExpressionsOf(handle.catch);
  const retry = retryExpressionsOf(handle.retry);

  return [...tests, ...retry];
}

function streamExpressionsOf(stream: Stream): readonly Expression[] {
  const source = sourceExpressionsOf(stream.source);
  const stop = stopExpressionsOf(stream.stop);

  return [...source, ...stop];
}

function extensionExpressionsOf(extend: Extend): readonly Expression[] {
  return extend.extensions.flatMap((extension) => extension.conditions);
}
