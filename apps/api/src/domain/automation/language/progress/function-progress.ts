import type { JsonPointer } from '../json-pointer.js';
import { RoundWork } from '../round-work.js';
import { Step } from '../step.js';
import type { TaskEnding } from '../endings/task-ending.js';
import { ConcludedProgress } from './concluded-progress.js';
import { KindProgress } from './kind-progress.js';

// Stage 3 of `call: <function>`: the declared function's task runs as a child, whose end ends
// the call.
export class FunctionProgress extends KindProgress {
  work(): RoundWork {
    return RoundWork.none();
  }

  record(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }

  childEnded(child: JsonPointer, ending: TaskEnding): Step<KindProgress> {
    const workflowEnd = ending.workflowEnd();

    if (workflowEnd !== null) return ConcludedProgress.step(workflowEnd);

    const outcome = ending.outcome();
    return ConcludedProgress.step(outcome);
  }

  subWorkflowAnswered(): Step<KindProgress> {
    return Step.of<KindProgress>(this);
  }
}
