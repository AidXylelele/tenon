import type {
  Case,
  Choose,
  Deadline,
  Directive,
  Export,
  ExportSchema,
  Expression,
  Extend,
  Extension,
  Guard,
  Handle,
  Invoke,
  Let,
  Loop,
  Parallel,
  Perform,
  Raise,
  Recovery,
  Sequence,
  Stream,
  TaskList,
  TaskTerm,
  Term,
  Transform,
} from "../forms/index.js";
import { decoderText, effectLinesOf, resourceLineOf } from "./effects.js";
import { catchLineOf, retryLineOf } from "./handling.js";
import { groupOf, labelledOf, leafOf, lineOf, type Line } from "./line.js";
import { iteratorLineOf, sourceLineOf, stopLineOf } from "./streams.js";
import {
  bindersText,
  durationText,
  expressionText,
  templateText,
} from "./values.js";

function directiveText(directive: Directive): string {
  switch (directive.kind) {
    case "continue":
    case "exit":
    case "end":
      return directive.kind;
    case "jump":
      return `jump ${String(directive.index)} (${directive.name})`;
  }
}

function ifLineOf(condition: Expression): Line {
  const text = expressionText(condition);
  return labelledOf("if", text);
}

function letText(target: Let["target"]): string {
  switch (target.kind) {
    case "slot":
      return `$${target.argument}`;
    case "activation":
      return `task.${target.field}`;
  }
}

function caseLineOf(item: Case): Line {
  const conditions = item.conditions.map(ifLineOf);
  const then = directiveText(item.then);

  return lineOf(`case then ${then}`, conditions);
}

function chooseLineOf(choose: Choose): Line {
  const cases = choose.cases.map(caseLineOf);
  return lineOf("choose", cases);
}

function listLineOf(list: TaskList): Line {
  const tasks = list.tasks.map(taskLineOf);
  return lineOf(`tasklist ${list.pointer}`, tasks);
}

function taskLineOf(task: TaskTerm): Line {
  const descriptor = task.descriptor;
  const then = directiveText(task.then);
  const head = `task ${descriptor.name} ${descriptor.reference} then ${then}`;
  const body = termLineOf(task.body);

  return lineOf(head, [body]);
}

function loopLineOf(loop: Loop): Line {
  const binders = bindersText(loop.binders);
  const head = `loop each ${binders}`;
  const itemsText = templateText(loop.items);
  const items = labelledOf("items", itemsText);
  const conditions = loop.conditions.map(ifLineOf);
  const body = listLineOf(loop.body);
  const children = [items, ...conditions, body];

  return lineOf(head, children);
}

function parallelLineOf(parallel: Parallel): Line {
  const branches = parallel.branches.map(listLineOf);
  return lineOf(`parallel join ${parallel.join}`, branches);
}

function streamLineOf(stream: Stream): Line {
  const source = sourceLineOf(stream.source);
  const stop = stopLineOf(stream.stop);
  const iterators = stream.iterators.map((iterator) => {
    const each = termLineOf(iterator.each);
    return iteratorLineOf(iterator, each);
  });
  const children = [source, stop, ...iterators];

  return lineOf("stream", children);
}

function extensionLineOf(extension: Extension): Line {
  const conditions = extension.conditions.map(ifLineOf);
  const beforeLists = extension.before.map(listLineOf);
  const afterLists = extension.after.map(listLineOf);
  const before = groupOf("before", beforeLists);
  const after = groupOf("after", afterLists);
  const head = `extension ${String(extension.index)}`;
  const children = [...conditions, before, after];

  return lineOf(head, children);
}

function schemaLineOf(head: string, schema: ExportSchema): Line {
  switch (schema.kind) {
    case "unchecked":
      return leafOf(`${head} unchecked`);
    case "compiled":
      return leafOf(`${head} compiled`);
    case "fetched": {
      const resource = resourceLineOf("resource", schema.resource);
      return lineOf(`${head} fetched`, [resource]);
    }
  }
}

function exportLineOf(term: Export): Line {
  const valueText = templateText(term.value);
  const head = `export ${valueText} schema`;

  return schemaLineOf(head, term.schema);
}

function guardLineOf(term: Guard): Line {
  const conditions = term.conditions.map(ifLineOf);
  const body = termLineOf(term.body);
  const children = [...conditions, body];

  return lineOf("guard", children);
}

function deadlineLineOf(term: Deadline): Line {
  const duration = durationText(term.duration);
  const head = `deadline ${duration}`;
  const body = termLineOf(term.body);

  return lineOf(head, [body]);
}

function recoveryLineOf(recovery: Recovery): Line {
  switch (recovery.kind) {
    case "recover": {
      const body = termLineOf(recovery.body);
      return groupOf("recover", [body]);
    }
    case "reraise":
      return leafOf("reraise");
  }
}

function handleLineOf(term: Handle): Line {
  const body = termLineOf(term.body);
  const recovery = recoveryLineOf(term.catch.recovery);
  const tried = groupOf("try", [body]);
  const caught = catchLineOf(term.catch, recovery);
  const retry = retryLineOf(term.retry);

  return lineOf("handle", [tried, caught, retry]);
}

function performLineOf(term: Perform): Line {
  const decoder = decoderText(term.decoder);
  const head = `perform ${term.effect.kind} decode ${decoder}`;
  const fields = effectLinesOf(term.effect);

  return lineOf(head, fields);
}

function extendLineOf(term: Extend): Line {
  const extensions = term.extensions.map(extensionLineOf);
  const extended = termLineOf(term.body);
  const staged = termLineOf(term.stages);
  const body = groupOf("body", [extended]);
  const stages = groupOf("stages", [staged]);
  const children = [...extensions, body, stages];

  return lineOf("extend", children);
}

function sequenceLineOf(term: Sequence): Line {
  const steps = term.steps.map(termLineOf);
  return lineOf("sequence", steps);
}

function letLineOf(term: Let): Line {
  const target = letText(term.target);
  const body = termLineOf(term.body);

  return lineOf(`let ${target}`, [body]);
}

function transformLineOf(term: Transform): Line {
  const valueText = templateText(term.value);
  return leafOf(`transform ${valueText}`);
}

function raiseLineOf(term: Raise): Line {
  const error = templateText(term.error);
  return leafOf(`raise ${error}`);
}

function invokeLineOf(term: Invoke): Line {
  const argumentsText = templateText(term.arguments);
  return leafOf(`invoke ${term.callee.key} ${argumentsText}`);
}

export function termLineOf(term: Term): Line {
  switch (term.form) {
    case "sequence":
      return sequenceLineOf(term);
    case "taskList":
      return listLineOf(term);
    case "task":
      return taskLineOf(term);
    case "let":
      return letLineOf(term);
    case "guard":
      return guardLineOf(term);
    case "transform":
      return transformLineOf(term);
    case "validate":
      return schemaLineOf("validate", term.schema);
    case "export":
      return exportLineOf(term);
    case "choose":
      return chooseLineOf(term);
    case "loop":
      return loopLineOf(term);
    case "perform":
      return performLineOf(term);
    case "raise":
      return raiseLineOf(term);
    case "handle":
      return handleLineOf(term);
    case "deadline":
      return deadlineLineOf(term);
    case "parallel":
      return parallelLineOf(term);
    case "stream":
      return streamLineOf(term);
    case "extend":
      return extendLineOf(term);
    case "invoke":
      return invokeLineOf(term);
  }
}
