import { Export } from '../../src/domain/automation/language/export.js';
import { FlowDirective } from '../../src/domain/automation/language/flow-directive.js';
import { Input } from '../../src/domain/automation/language/input.js';
import type { JsonPointer } from '../../src/domain/automation/language/json-pointer.js';
import { Output } from '../../src/domain/automation/language/output.js';
import type { Task } from '../../src/domain/automation/language/tasks/task.js';
import { TaskBase } from '../../src/domain/automation/language/task-base.js';
import { TaskList } from '../../src/domain/automation/language/task-list.js';
import { FunctionCallTask } from '../../src/domain/automation/language/tasks/function-call-task.js';
import { SetTask } from '../../src/domain/automation/language/tasks/set-task.js';
import { Template } from '../../src/domain/automation/language/template.js';
import { DefinitionRejectedError } from '../../src/domain/errors.js';

export function baseAt(at: JsonPointer, then: string | null = null): TaskBase {
  const thenAt = at.at('then');
  const name = then ?? undefined;
  const directive = FlowDirective.named(name, thenAt);
  return new TaskBase({
    condition: null,
    input: Input.none(),
    output: Output.none(),
    export: Export.none(),
    timeout: null,
    then: directive,
  });
}

export function setTask(
  list: JsonPointer,
  index: number,
  name: string,
  then: string | null = null,
): SetTask {
  const reference = list.at(index).at(name);
  const base = baseAt(reference, then);
  const valueAt = reference.at('set');
  const value = new Template({
    pointer: valueAt,
    value: { greeting: '${ .name }' },
  });
  return new SetTask({ name, reference, base, value });
}

export function callTask(
  reference: JsonPointer,
  name: string,
  callee: string,
  then: string | null = null,
): FunctionCallTask {
  const base = baseAt(reference, then);
  return new FunctionCallTask({
    name,
    reference,
    base,
    function: callee,
    arguments: null,
  });
}

export function taskList(at: JsonPointer, tasks: readonly Task[]): TaskList {
  return new TaskList({ reference: at, tasks });
}

export function rejectionOf(build: () => unknown): DefinitionRejectedError {
  try {
    build();
  } catch (error) {
    if (error instanceof DefinitionRejectedError) return error;

    throw error;
  }

  throw new Error('The definition was not rejected');
}
