import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject } from '../../../domain/automation/json.js';
import type { CheckProblem } from '../../../interface-adapters/workflows/interfaces.js';
import { TaskKind } from '../enums.js';
import { DefinitionWalk } from '../document/definition-walk.js';
import { JsonPointer } from '../document/json-pointer.js';
import { JsonWalk } from '../document/json-walk.js';
import type { LocatedTask } from '../document/located-task.js';
import { TaskKinds } from '../document/task-kind.js';
import type { DefinitionCheck } from '../interfaces.js';

// Names a document refers to resolve, as a compiler resolves identifiers: a `then` names a
// task of its own list, and a function, error, retry, timeout or authentication by name is one
// declared in `use`.
export class ReferenceCheck implements DefinitionCheck {
  static readonly #DIRECTIVES = new Set(['continue', 'exit', 'end']);
  static readonly #CALLS = new Set([
    'asyncapi',
    'grpc',
    'http',
    'openapi',
    'a2a',
    'mcp',
  ]);
  static readonly #SKIPPED = new Set(['document', 'code']);

  firstProblem(workflow: Specification.Workflow): Promise<CheckProblem | null> {
    const use = (workflow.use ?? {}) as JsonObject;
    const problem =
      ReferenceCheck.#tasks(workflow, use) ??
      ReferenceCheck.#workflowTimeout(workflow, use) ??
      ReferenceCheck.#authentications(workflow, use);
    return Promise.resolve(problem);
  }

  static #tasks(
    workflow: Specification.Workflow,
    use: JsonObject,
  ): CheckProblem | null {
    for (const located of DefinitionWalk.tasksOf(workflow)) {
      const problem =
        ReferenceCheck.#then(located) ??
        ReferenceCheck.#switch(located) ??
        ReferenceCheck.#declared(located, use);

      if (problem !== null) return problem;
    }

    return null;
  }

  static #then(located: LocatedTask): CheckProblem | null {
    const then = located.task.then;

    if (then === undefined) return null;

    const at = located.pointer.child('then');
    return ReferenceCheck.#target(then, located, at);
  }

  static #switch(located: LocatedTask): CheckProblem | null {
    const kind = TaskKinds.of(located.task);

    if (kind !== TaskKind.Switch) return null;

    const cases = (located.task as Specification.SwitchTask).switch ?? [];
    const list = located.pointer.child('switch');

    for (const [index, item] of cases.entries()) {
      for (const [name, match] of Object.entries(item)) {
        const at = list.child(index).child(name).child('then');
        const problem = ReferenceCheck.#target(match.then, located, at);

        if (problem !== null) return problem;
      }
    }

    return null;
  }

  // A directive, or a sibling: a function body (no list) can name no task.
  static #target(
    target: string,
    located: LocatedTask,
    at: JsonPointer,
  ): CheckProblem | null {
    if (ReferenceCheck.#DIRECTIVES.has(target)) return null;

    const list = located.list ?? [];
    const sibling = list.some((item) => Object.hasOwn(item, target));

    if (sibling) return null;

    const pointer = at.toString();
    return { pointer, detail: `no task named '${target}' in this list` };
  }

  static #declared(located: LocatedTask, use: JsonObject): CheckProblem | null {
    const task = located.task;
    const kind = TaskKinds.of(task);

    if (kind === TaskKind.Call) {
      const call = String((task as Specification.CallTask).call);
      const builtIn = ReferenceCheck.#CALLS.has(call);

      if (!builtIn) {
        const at = located.pointer.child('call');
        const problem = ReferenceCheck.#named(use, 'functions', call, at);

        if (problem !== null) return problem;
      }
    }

    if (kind === TaskKind.Raise) {
      const error = (task as Specification.RaiseTask).raise?.error;

      if (typeof error === 'string') {
        const at = located.pointer.child('raise').child('error');
        const problem = ReferenceCheck.#named(use, 'errors', error, at);

        if (problem !== null) return problem;
      }
    }

    if (kind === TaskKind.Try) {
      const retry = (task as Specification.TryTask).catch?.retry;

      if (typeof retry === 'string') {
        const at = located.pointer.child('catch').child('retry');
        const problem = ReferenceCheck.#named(use, 'retries', retry, at);

        if (problem !== null) return problem;
      }
    }

    const timeout = task.timeout;

    if (typeof timeout === 'string') {
      const at = located.pointer.child('timeout');
      return ReferenceCheck.#named(use, 'timeouts', timeout, at);
    }

    return null;
  }

  static #workflowTimeout(
    workflow: Specification.Workflow,
    use: JsonObject,
  ): CheckProblem | null {
    const timeout = workflow.timeout;

    if (typeof timeout !== 'string') return null;

    const at = JsonPointer.ROOT.child('timeout');
    return ReferenceCheck.#named(use, 'timeouts', timeout, at);
  }

  // `authentication: { use: <name> }` names a policy of `use.authentications`.
  static #authentications(
    workflow: Specification.Workflow,
    use: JsonObject,
  ): CheckProblem | null {
    const values = JsonWalk.valuesOf(
      workflow as unknown as JsonObject,
      ReferenceCheck.#SKIPPED,
    );

    for (const located of values) {
      if (located.key !== 'authentication') continue;

      const reference = located.value as JsonObject | null;
      const name = reference?.use;

      if (typeof name !== 'string') continue;

      const at = located.pointer.child('use');
      const problem = ReferenceCheck.#named(use, 'authentications', name, at);

      if (problem !== null) return problem;
    }

    return null;
  }

  static #named(
    use: JsonObject,
    section: string,
    name: string,
    at: JsonPointer,
  ): CheckProblem | null {
    const declared = (use[section] ?? {}) as JsonObject;

    if (Object.hasOwn(declared, name)) return null;

    const pointer = at.toString();
    return { pointer, detail: `'${name}' is not declared in use.${section}` };
  }
}
