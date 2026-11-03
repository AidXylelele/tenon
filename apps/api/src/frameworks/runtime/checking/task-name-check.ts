import type { Specification } from '@openworkflowspec/sdk';
import type { CheckProblem } from '../../../interface-adapters/workflows/interfaces.js';
import { DefinitionWalk } from '../document/definition-walk.js';
import type { DefinitionCheck } from '../interfaces.js';

// A task's name identifies it within its list: `then` jumps to it by name.
export class TaskNameCheck implements DefinitionCheck {
  firstProblem(workflow: Specification.Workflow): Promise<CheckProblem | null> {
    const seen = new Map<Specification.TaskList, Set<string>>();

    for (const located of DefinitionWalk.tasksOf(workflow)) {
      const list = located.list;

      if (list === null) continue;

      const names = seen.get(list) ?? new Set<string>();
      seen.set(list, names);

      if (names.has(located.name)) {
        const pointer = located.pointer.toString();
        const detail = `the task name '${located.name}' is used twice in this list`;
        return Promise.resolve({ pointer, detail });
      }

      names.add(located.name);
    }

    return Promise.resolve(null);
  }
}
