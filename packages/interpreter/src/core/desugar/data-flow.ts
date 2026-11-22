import { iterationBindersOf } from "../../semantics/index.js";
import type * as ast from "../../syntax/index.js";
import {
  type Descriptor,
  type Export,
  type ExportSchema,
  type Guard,
  type Iterator,
  type Let,
  type Role,
  type TaskTerm,
  type Template,
  type Term,
  activationTarget,
  binding,
  currentValue,
  deadline,
  exportTerm,
  extend,
  guard,
  sequence,
  slotTarget,
  storedContext,
  task as taskTerm,
  transform,
  uncheckedExport,
  validate,
} from "../forms/index.js";
import {
  type ActivationMark,
  binderFrameOf,
  inputFrame,
  outputFrame,
} from "../storage/index.js";
import { bindersOf } from "./binders.js";
import { bodyOf } from "./bodies.js";
import { componentOf } from "./components.js";
import type { Context } from "./context.js";
import { directiveOf } from "./directives.js";
import { taskListOf, taskListsOf } from "./do.js";
import { durationOf } from "./durations.js";
import { conditionsOf } from "./expressions.js";
import { applyingOf } from "./extensions.js";
import { schemaOf } from "./schemas.js";
import { writtenTemplateOf } from "./templates.js";

const noSteps: readonly Term[] = [];

export function taskFlowOf(task: ast.Task, context: Context): TaskTerm {
  return activationOf(task, context.taskActivation, context);
}

export function branchFlowOf(task: ast.Task, context: Context): TaskTerm {
  return activationOf(task, "own", context);
}

export function iteratorFlowOf(
  iterator: ast.SubscriptionIterator,
  context: Context,
): Iterator {
  const declared = iterationBindersOf(
    iterator.pointer,
    iterator.item,
    iterator.at,
  );
  const binders = bindersOf(declared);
  const frame = binderFrameOf(binders);
  const iterating = context.extended(frame);
  const each = itemStagesOf(iterator, iterating);

  return { binders, each };
}

export function workflowFlowOf(workflow: ast.Workflow, context: Context): Term {
  const id = context.termIdOf(workflow.pointer, "workflow");
  const input = workflow.input;
  const output = workflow.output;
  const inputSchema = validationsOf(input.schema, "input-schema", context);
  const inputFrom = transformationsOf(input.from, "input-from", context);
  const initial = initialContextOf(workflow, context);
  const tasks = taskListOf(workflow.do, context);
  const outputAs = transformationsOf(output.as, "output-as", context);
  const outputSchema = validationsOf(output.schema, "output-schema", context);
  const steps = [
    ...inputSchema,
    ...inputFrom,
    initial,
    tasks,
    ...outputAs,
    ...outputSchema,
  ];
  const body = sequence({ id, steps });

  return deadlinedOf(workflow.timeout, body, context);
}

function activationOf(
  task: ast.Task,
  mark: ActivationMark,
  context: Context,
): TaskTerm {
  const inside = context.entered(mark);
  const id = inside.termIdOf(task.pointer, "task");
  const descriptor = descriptorOf(task, context);
  const then = directiveOf(task.then, context);
  const body = rawInputOf(task, inside);

  return taskTerm({ id, descriptor, then, body });
}

function descriptorOf(task: ast.Task, context: Context): Descriptor {
  const definition = context.definitions.definitionOf(task.pointer);
  return { name: task.name, reference: task.pointer, definition };
}

function rawInputOf(task: ast.Task, context: Context): Let {
  const id = context.termIdOf(task.pointer, "task-input");
  const target = activationTarget({ field: "input" });
  const started = startGateOf(task, context);

  return binding({ id, target, body: started });
}

function startGateOf(task: ast.Task, context: Context): Guard {
  const id = context.termIdOf(task.pointer, "guard");
  const conditions = conditionsOf(task.if, context);
  const stages = inputStagesOf(task, context);
  const body = deadlinedOf(task.timeout, stages, context);

  return guard({ id, conditions, body });
}

function inputStagesOf(task: ast.Task, context: Context): Term {
  const input = task.input;
  const id = context.termIdOf(input.pointer, "input-stages");
  const inputSchema = validationsOf(input.schema, "input-schema", context);
  const inputFrom = transformationsOf(input.from, "input-from", context);
  const bound = inputOf(task, context);
  const steps = [...inputSchema, ...inputFrom, bound];

  return sequence({ id, steps });
}

function inputOf(task: ast.Task, context: Context): Let {
  const id = context.termIdOf(task.input.pointer, "input");
  const target = slotTarget({ argument: "input" });
  const inside = context.extended(inputFrame);
  const run = runOf(task, inside);

  return binding({ id, target, body: run });
}

function runOf(task: ast.Task, context: Context): Term {
  const body = bodyOf(task, context);
  const stages = rawOutputOf(task, context);
  const extensions = applyingOf(task, context);

  if (extensions.length === 0) {
    const id = context.termIdOf(task.pointer, "run");
    const steps = [body, stages];
    return sequence({ id, steps });
  }

  const id = context.termIdOf(task.pointer, "extend");
  return extend({ id, extensions, body, stages });
}

function rawOutputOf(task: ast.Task, context: Context): Let {
  const id = context.termIdOf(task.pointer, "task-output");
  const target = activationTarget({ field: "output" });
  const stages = outputStagesOf(task.output, task.export, context);

  return binding({ id, target, body: stages });
}

function outputStagesOf(
  output: ast.Output,
  exported: ast.Export,
  context: Context,
): Term {
  const id = context.termIdOf(output.pointer, "output-stages");
  const outputAs = transformationsOf(output.as, "output-as", context);
  const bound = outputOf(output, exported, context);
  const steps = [...outputAs, bound];

  return sequence({ id, steps });
}

function outputOf(
  output: ast.Output,
  exported: ast.Export,
  context: Context,
): Let {
  const id = context.termIdOf(output.pointer, "output");
  const target = slotTarget({ argument: "output" });
  const inside = context.extended(outputFrame);
  const stages = exportStagesOf(output, exported, inside);

  return binding({ id, target, body: stages });
}

function exportStagesOf(
  output: ast.Output,
  exported: ast.Export,
  context: Context,
): Term {
  const id = context.termIdOf(exported.pointer, "export-stages");
  const outputSchema = validationsOf(output.schema, "output-schema", context);
  const exports = exportsOf(exported, context);
  const steps = [...outputSchema, ...exports];

  return sequence({ id, steps });
}

function itemStagesOf(
  iterator: ast.SubscriptionIterator,
  context: Context,
): Term {
  const id = context.termIdOf(iterator.pointer, "item-stages");
  const tasks = taskListsOf(iterator.do, context);
  const stages = outputStagesOf(iterator.output, iterator.export, context);
  const steps = [...tasks, stages];

  return sequence({ id, steps });
}

function initialContextOf(workflow: ast.Workflow, context: Context): Export {
  const id = context.termIdOf(workflow.pointer, "initial-context");
  return exportTerm({ id, value: currentValue, schema: uncheckedExport });
}

function validationsOf(
  schema: ast.Schema | null,
  role: Role,
  context: Context,
): readonly Term[] {
  if (schema === null) {
    return noSteps;
  }

  const id = context.termIdOf(schema.pointer, role);
  const checked = schemaOf(schema, context);
  const step = validate({ id, schema: checked });

  return [step];
}

function transformationsOf(
  template: ast.ValueTemplate | null,
  role: Role,
  context: Context,
): readonly Term[] {
  if (template === null) {
    return noSteps;
  }

  const id = context.termIdOf(template.pointer, role);
  const value = writtenTemplateOf(template, context);
  const step = transform({ id, value });

  return [step];
}

function exportsOf(exported: ast.Export, context: Context): readonly Term[] {
  const writesNeither = exported.as === null && exported.schema === null;

  if (writesNeither) {
    return noSteps;
  }

  const id = context.termIdOf(exported.pointer, "export");
  const value = exportedValueOf(exported.as, context);
  const schema = exportSchemaOf(exported.schema, context);
  const step = exportTerm({ id, value, schema });

  return [step];
}

function exportedValueOf(
  template: ast.ValueTemplate | null,
  context: Context,
): Template {
  if (template === null) {
    return storedContext;
  }

  return writtenTemplateOf(template, context);
}

function exportSchemaOf(
  schema: ast.Schema | null,
  context: Context,
): ExportSchema {
  if (schema === null) {
    return uncheckedExport;
  }

  return schemaOf(schema, context);
}

function deadlinedOf(
  timeout: ast.Timeout | ast.Reference | null,
  body: Term,
  context: Context,
): Term {
  if (timeout === null) {
    return body;
  }

  const id = context.termIdOf(timeout.pointer, "timeout");
  const timeouts = context.model.symbols.references.timeouts;
  const substitution = componentOf(timeout, timeouts, context);
  const after = substitution.component.after;
  const duration = durationOf(after, substitution.context);

  return deadline({ id, duration, body });
}
