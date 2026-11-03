import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject } from '../../../domain/automation/json.js';
import type { CheckProblem } from '../../../interface-adapters/workflows/interfaces.js';
import { TaskKind } from '../enums.js';
import { DefinitionWalk } from '../document/definition-walk.js';
import { Durations } from '../document/durations.js';
import { JsonPointer } from '../document/json-pointer.js';
import { TaskKinds } from '../document/task-kind.js';
import type { DefinitionCheck } from '../interfaces.js';

interface DurationAt {
  readonly pointer: JsonPointer;
  readonly duration: Specification.Duration;
  readonly evaluated: boolean;
}

// Every fixed duration of a document has a length; a wait and a timeout may also be an
// expression the runtime evaluates.
export class DurationCheck implements DefinitionCheck {
  firstProblem(workflow: Specification.Workflow): Promise<CheckProblem | null> {
    for (const found of DurationCheck.#durationsOf(workflow)) {
      const expression = Durations.isExpression(found.duration);

      if (expression && found.evaluated) continue;

      const problem = expression
        ? 'this duration cannot be an expression'
        : Durations.problemOf(found.duration);

      if (problem !== null) {
        const pointer = found.pointer.toString();
        return Promise.resolve({ pointer, detail: problem });
      }
    }

    return Promise.resolve(null);
  }

  static #durationsOf(workflow: Specification.Workflow): readonly DurationAt[] {
    const found: DurationAt[] = [];
    const root = JsonPointer.ROOT;
    DurationCheck.#timeout(workflow.timeout, root.child('timeout'), found);
    const use = (workflow.use ?? {}) as JsonObject;
    const timeouts = (use.timeouts ?? {}) as JsonObject;

    for (const [name, timeout] of Object.entries(timeouts)) {
      const at = root.child('use').child('timeouts').child(name);
      DurationCheck.#timeout(timeout, at, found);
    }

    const retries = (use.retries ?? {}) as JsonObject;

    for (const [name, retry] of Object.entries(retries)) {
      const at = root.child('use').child('retries').child(name);
      DurationCheck.#retry(retry as JsonObject, at, found);
    }

    const schedule = (workflow.schedule ?? {}) as JsonObject;

    for (const key of ['every', 'after']) {
      const duration = schedule[key];

      if (duration === undefined) continue;

      const at = root.child('schedule').child(key);
      found.push({
        pointer: at,
        duration: duration as Specification.Duration,
        evaluated: false,
      });
    }

    for (const located of DefinitionWalk.tasksOf(workflow)) {
      const task = located.task;
      const at = located.pointer;
      DurationCheck.#timeout(task.timeout, at.child('timeout'), found);
      const kind = TaskKinds.of(task);

      if (kind === TaskKind.Wait) {
        const wait = (task as Specification.WaitTask).wait ?? '';
        found.push({
          pointer: at.child('wait'),
          duration: wait,
          evaluated: true,
        });
      }

      if (kind === TaskKind.Try) {
        const retry = (task as Specification.TryTask).catch?.retry;

        if (retry !== undefined && typeof retry !== 'string') {
          const retryAt = at.child('catch').child('retry');
          DurationCheck.#retry(retry as JsonObject, retryAt, found);
        }
      }
    }

    return found;
  }

  // An inline timeout; one named is declared in `use.timeouts` and checked there.
  static #timeout(
    timeout: unknown,
    at: JsonPointer,
    found: DurationAt[],
  ): void {
    if (timeout === undefined || typeof timeout === 'string') return;

    const after = (timeout as Specification.Timeout).after;
    found.push({
      pointer: at.child('after'),
      duration: after,
      evaluated: true,
    });
  }

  static #retry(retry: JsonObject, at: JsonPointer, found: DurationAt[]): void {
    const delay = retry.delay;

    if (delay !== undefined)
      found.push({
        pointer: at.child('delay'),
        duration: delay as Specification.Duration,
        evaluated: false,
      });

    const limit = (retry.limit ?? {}) as JsonObject;

    if (limit.duration !== undefined) {
      const limitAt = at.child('limit').child('duration');
      found.push({
        pointer: limitAt,
        duration: limit.duration as Specification.Duration,
        evaluated: false,
      });
    }

    const jitter = (retry.jitter ?? {}) as JsonObject;

    for (const bound of ['from', 'to']) {
      const duration = jitter[bound];

      if (duration === undefined) continue;

      const boundAt = at.child('jitter').child(bound);
      found.push({
        pointer: boundAt,
        duration: duration as Specification.Duration,
        evaluated: false,
      });
    }
  }
}
