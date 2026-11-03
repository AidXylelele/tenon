import { HttpStatus } from '@nestjs/common';
import { Missing } from '../../../application/automation/enums.js';
import type { DefinitionProblem } from '../../../application/automation/workflows/ports.js';
import { SubscriptionRefusal } from '../../../domain/automation/subscriptions/enums.js';
import { SecretRefusal } from '../../../domain/automation/secrets/enums.js';
import { InstanceRefusal } from '../../../domain/automation/instances/enums.js';
import { WorkflowRefusal } from '../../../domain/automation/workflows/enums.js';
import { ProblemException } from '../filters/problem.exception.js';

export type AutomationFailure =
  | DefinitionProblem
  | WorkflowRefusal
  | InstanceRefusal
  | SecretRefusal
  | SubscriptionRefusal
  | Missing;

interface Described {
  readonly status: number;
  readonly title: string;
}

// The problem a refused request answers with; the codes the domain and the use cases return
// become their messages here.
export class ProblemPresenter {
  private static readonly TYPE = 'urn:problem:';
  private static readonly INVALID = 'definition.invalid';
  private static readonly SUBSCRIPTION_INVALID = 'subscription.invalid';
  private static readonly FILTER = '/filter';

  private static readonly DESCRIBED = new Map<string, Described>([
    [
      WorkflowRefusal.Archived,
      { status: HttpStatus.CONFLICT, title: 'The workflow is archived' },
    ],
    [
      WorkflowRefusal.Off,
      { status: HttpStatus.CONFLICT, title: 'The workflow is off' },
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
    [
      SecretRefusal.NameTaken,
      {
        status: HttpStatus.CONFLICT,
        title: 'You already have a secret of this name',
      },
    ],
    [
      Missing.Secret,
      { status: HttpStatus.NOT_FOUND, title: 'The secret does not exist' },
    ],
    [
      SubscriptionRefusal.ForeignSecret,
      {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        title: 'The secret is not one of yours',
      },
    ],
    [
      Missing.Subscription,
      {
        status: HttpStatus.NOT_FOUND,
        title: 'The subscription does not exist',
      },
    ],
    [
      Missing.Webhook,
      { status: HttpStatus.NOT_FOUND, title: 'The webhook does not exist' },
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

  // A subscription refused: its filter at the first problem, located in the request's
  // `filter`, or a refusal the subscription named.
  static ofSubscription(
    failure: DefinitionProblem | SubscriptionRefusal,
  ): ProblemException {
    if (typeof failure !== 'object') return ProblemPresenter.of(failure);

    const pointer = `${ProblemPresenter.FILTER}${failure.pointer}`;
    const located = { pointer, detail: failure.detail };
    return ProblemPresenter.#located(
      located,
      ProblemPresenter.SUBSCRIPTION_INVALID,
      'The subscription is invalid',
    );
  }

  static #invalid(problem: DefinitionProblem): ProblemException {
    return ProblemPresenter.#located(
      problem,
      ProblemPresenter.INVALID,
      'The workflow definition is invalid',
    );
  }

  static #located(
    problem: DefinitionProblem,
    code: string,
    title: string,
  ): ProblemException {
    const type = `${ProblemPresenter.TYPE}${code}`;
    const location = { pointer: problem.pointer, detail: problem.detail };
    return new ProblemException({
      type,
      title,
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      detail: problem.detail,
      errors: [location],
    });
  }
}
