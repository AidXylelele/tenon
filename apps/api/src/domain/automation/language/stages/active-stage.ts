import type { TaskScope } from '../scopes/task-scope.js';
import { EndedStage } from './ended-stage.js';
import { TaskProgress } from './task-progress.js';

// A stage before the task ended: its timeout faults the task.
export abstract class ActiveStage extends TaskProgress {
  timeOut(scope: TaskScope): TaskProgress {
    return EndedStage.timedOut(scope);
  }
}
