import { HttpStatus } from '@nestjs/common';
import { Missing } from '../../../application/automation/enums.js';
import type { DefinitionProblem } from '../../../application/automation/workflows/ports.js';
import { InstanceRefusal } from '../../../domain/automation/instances/enums.js';
import { WorkflowRefusal } from '../../../domain/automation/workflows/enums.js';
import { ProblemException } from '../filters/problem.exception.js';

export type AutomationFailure =
  DefinitionProblem | WorkflowRefusal | InstanceRefusal | Missing;

interface Described {
  readonly status: number;
  readonly title: string;
}

// The problem a refused request answers with; the codes the domain and the use cases return
// become their messages here.
export class ProblemPresenter {
  private static readonly TYPE = 'urn:problem:';
  private static readonly INVALID = 'definition.invalid';

  private static readonly DESCRIBED = new Map<string, Described>([
    [
      WorkflowRefusal.Archived,
      { status: HttpStatus.CONFLICT, title: 'The workflow is archived' },
    ],
    [
      WorkflowRefusal.VersionTaken,
      {
        status: HttpStatus.CONFLICT,
        title:
          'A different document is already published under this namespace, name and version',
      },
    ],
    [
      InstanceRefusal.Ended,
      { status: HttpStatus.CONFLICT, title: 'The instance has ended' },
    ],
    [
      InstanceRefusal.NotEnded,
      { status: HttpStatus.CONFLICT, title: 'The instance has not ended' },
    ],
    [
      InstanceRefusal.NotRunning,
      {
        status: HttpStatus.CONFLICT,
        title: 'The instance is neither running nor waiting',
      },
    ],
    [
      InstanceRefusal.NotSuspended,
      { status: HttpStatus.CONFLICT, title: 'The instance is not suspended' },
    ],
    [
      Missing.Workflow,
      { status: HttpStatus.NOT_FOUND, title: 'The workflow does not exist' },
    ],
    [
      Missing.Version,
      {
        status: HttpStatus.NOT_FOUND,
        title: 'The workflow version does not exist',
      },
    ],
    [
      Missing.Instance,
      {
        status: HttpStatus.NOT_FOUND,
        title: 'The workflow instance does not exist',
      },
    ],
  ]);

  static of(failure: AutomationFailure): ProblemException {
    if (typeof failure === 'object') return ProblemPresenter.#invalid(failure);

    const described = ProblemPresenter.DESCRIBED.get(failure);

    if (described === undefined)
      throw new TypeError(`No problem describes ${failure}`);

    const type = `${ProblemPresenter.TYPE}${failure}`;
    return new ProblemException({
      type,
      title: described.title,
      status: described.status,
      detail: described.title,
    });
  }

  static #invalid(problem: DefinitionProblem): ProblemException {
    const type = `${ProblemPresenter.TYPE}${ProblemPresenter.INVALID}`;
    const location = { pointer: problem.pointer, detail: problem.detail };
    return new ProblemException({
      type,
      title: 'The workflow definition is invalid',
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      detail: problem.detail,
      errors: [location],
    });
  }
}
