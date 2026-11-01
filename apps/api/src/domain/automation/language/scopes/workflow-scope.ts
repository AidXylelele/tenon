import type { JsonObject } from '../interfaces.js';
import type { DoTask } from '../tasks/do-task.js';
import { TaskScope } from './task-scope.js';

export class WorkflowScope extends TaskScope<DoTask> {
  override entryArguments(): JsonObject {
    return { workflow: this.workflow, runtime: this.runtime };
  }

  override outputArguments(): JsonObject {
    return {
      context: this.context,
      workflow: this.workflow,
      runtime: this.runtime,
    };
  }
}
