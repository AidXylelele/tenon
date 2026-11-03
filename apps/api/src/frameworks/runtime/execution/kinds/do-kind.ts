import type { Specification } from '@openworkflowspec/sdk';
import type {
  JsonObject,
  JsonValue,
} from '../../../../domain/automation/json.js';
import type { CompositeKind, ListEnding, Runner } from '../endings.js';
import type { Scope } from '../scope.js';

// `do`: its tasks in order, each given the previous one's output.
export class DoKind implements CompositeKind {
  run(
    task: Specification.Task,
    input: JsonValue,
    _args: JsonObject,
    scope: Scope,
    runner: Runner,
  ): Promise<ListEnding> {
    const body = (task as Specification.DoTask).do ?? [];
    const bodyScope = scope.child('do');
    return runner.list(body, input, bodyScope);
  }
}
