import type { Specification } from '@openworkflowspec/sdk';
import { TaskKind } from '../enums.js';
import { JsonPointer } from './json-pointer.js';
import { LocatedTask } from './located-task.js';
import { TaskKinds } from './task-kind.js';

// Every task of a document, depth first, in each task list it appears in, and the functions
// declared in `use.functions`.
export class DefinitionWalk {
  readonly #found: LocatedTask[] = [];

  static tasksOf(workflow: Specification.Workflow): readonly LocatedTask[] {
    const walk = new DefinitionWalk();
    const root = JsonPointer.ROOT.child('do');
    walk.#list(workflow.do, root);
    walk.#functions(workflow);
    return walk.#found;
  }

  #functions(workflow: Specification.Workflow): void {
    const functions = workflow.use?.functions ?? {};
    const declared = JsonPointer.ROOT.child('use').child('functions');

    for (const [name, task] of Object.entries(functions)) {
      const pointer = declared.child(name);
      const located = new LocatedTask(pointer, name, task, null);
      this.#visit(located);
    }
  }

  #list(list: Specification.TaskList | undefined, at: JsonPointer): void {
    if (list === undefined) return;

    for (const [index, item] of list.entries()) {
      const entry = at.child(index);

      for (const [name, task] of Object.entries(item)) {
        const pointer = entry.child(name);
        const located = new LocatedTask(pointer, name, task, list);
        this.#visit(located);
      }
    }
  }

  #visit(located: LocatedTask): void {
    this.#found.push(located);
    const task = located.task;
    const at = located.pointer;
    const kind = TaskKinds.of(task);

    if (kind === TaskKind.Do || kind === TaskKind.For) {
      const body = (task as Specification.DoTask).do;
      const pointer = at.child('do');
      this.#list(body, pointer);
    }

    if (kind === TaskKind.Try) this.#try(task, at);

    if (kind === TaskKind.Fork) {
      const branches = (task as Specification.ForkTask).fork?.branches;
      const pointer = at.child('fork').child('branches');
      this.#list(branches, pointer);
    }
  }

  #try(task: Specification.TryTask, at: JsonPointer): void {
    const body = at.child('try');
    this.#list(task.try, body);
    const handler = at.child('catch').child('do');
    this.#list(task.catch?.do, handler);
  }
}
