import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  GoneException,
  type HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
  type Type,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { NameRefusal } from "../../../application/automation/drafts/enums.js";
import { Missing } from "../../../application/automation/enums.js";
import { ImportRefusal } from "../../../application/automation/imports/enums.js";
import { EndpointRefusal } from "../../../application/automation/subscriptions/enums.js";
import type { InputProblem } from "../../../application/automation/instances/interfaces.js";
import { DefinitionRefusal } from "../../../application/automation/workflows/enums.js";
import type { DefinitionProblem } from "../../../application/automation/workflows/interfaces.js";
import { Missing as IdentityMissing } from "../../../application/identity/enums.js";
import { DraftRefusal } from "../../../domain/automation/drafts/enums.js";
import { InstanceRefusal } from "../../../domain/automation/instances/enums.js";
import { SecretRefusal } from "../../../domain/automation/secrets/enums.js";
import { SubscriptionRefusal } from "../../../domain/automation/subscriptions/enums.js";
import { WorkflowRefusal } from "../../../domain/automation/workflows/enums.js";
import { AccountRefusal } from "../../../domain/identity/accounts/enums.js";
import { InvitationRefusal } from "../../../domain/identity/invitations/enums.js";
import { UserRefusal } from "../../../domain/identity/users/enums.js";
import type { ProblemDetails } from "../pipeline/interfaces.js";
import type { Described, Failure, Refusal } from "./interfaces.js";

@Injectable()
export class ProblemPresenter {
  private static readonly TYPE = "urn:problem:";
  private static readonly DEFINITION_INVALID = "definition.invalid";
  private static readonly SUBSCRIPTION_INVALID = "subscription.invalid";
  private static readonly INPUT_INVALID = "instance.input-invalid";
  private static readonly INPUT = "/input";
  private static readonly FILTER = "/filter";
  private static readonly SEPARATOR = "; ";

  private static readonly EXCEPTIONS = new Map<number, Type<HttpException>>([
    [HttpStatus.UNAUTHORIZED, UnauthorizedException],
    [HttpStatus.FORBIDDEN, ForbiddenException],
    [HttpStatus.NOT_FOUND, NotFoundException],
    [HttpStatus.CONFLICT, ConflictException],
    [HttpStatus.GONE, GoneException],
    [HttpStatus.PRECONDITION_FAILED, PreconditionFailedException],
    [HttpStatus.UNPROCESSABLE_ENTITY, UnprocessableEntityException],
    [HttpStatus.BAD_GATEWAY, BadGatewayException],
    [HttpStatus.GATEWAY_TIMEOUT, GatewayTimeoutException],
  ]);

  private static readonly DESCRIBED = new Map<string, Described>([
    [
      DefinitionRefusal.Expired,
      {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        title: "Check timed out",
        detail: "The document did not compile within the time limit",
      },
    ],
    [
      DefinitionRefusal.OtherWorkflow,
      {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        title: "Another workflow's document",
        detail: "The document names another workflow than its draft",
      },
    ],
    [
      WorkflowRefusal.Archived,
      {
        status: HttpStatus.CONFLICT,
        title: "Workflow archived",
        detail: "The workflow is archived",
      },
    ],
    [
      WorkflowRefusal.Unpublished,
      {
        status: HttpStatus.NOT_FOUND,
        title: "Workflow not found",
        detail: "The workflow has no published version",
      },
    ],
    [
      WorkflowRefusal.Off,
      {
        status: HttpStatus.CONFLICT,
        title: "Workflow off",
        detail: "The workflow is off",
      },
    ],
    [
      WorkflowRefusal.VersionTaken,
      {
        status: HttpStatus.CONFLICT,
        title: "Version taken",
        detail:
          "A different document is already published under this namespace, name and version",
      },
    ],
    [
      InstanceRefusal.Ended,
      {
        status: HttpStatus.CONFLICT,
        title: "Run ended",
        detail: "The instance has ended",
      },
    ],
    [
      InstanceRefusal.NotEnded,
      {
        status: HttpStatus.CONFLICT,
        title: "Run not ended",
        detail: "The instance has not ended",
      },
    ],
    [
      InstanceRefusal.NotRunning,
      {
        status: HttpStatus.CONFLICT,
        title: "Run not running",
        detail: "The instance is neither running nor waiting",
      },
    ],
    [
      InstanceRefusal.NotSuspended,
      {
        status: HttpStatus.CONFLICT,
        title: "Run not suspended",
        detail: "The instance is not suspended",
      },
    ],
    [
      SecretRefusal.NameTaken,
      {
        status: HttpStatus.CONFLICT,
        title: "Secret name taken",
        detail: "You already have a secret of this name",
      },
    ],
    [
      SecretRefusal.TooShort,
      {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        title: "Secret too short",
        detail: "Every text a secret holds is at least four characters long",
      },
    ],
    [
      SubscriptionRefusal.ForeignSecret,
      {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        title: "Secret not yours",
        detail: "The secret is not one of yours",
      },
    ],
    [
      EndpointRefusal.PrivateAddress,
      {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        title: "Endpoint refused",
        detail:
          "The endpoint's address is private, loopback or link-local and not allow-listed",
      },
    ],
    [
      DraftRefusal.Exists,
      {
        status: HttpStatus.PRECONDITION_FAILED,
        title: "Draft exists",
        detail: "The workflow already has a draft",
      },
    ],
    [
      DraftRefusal.Stale,
      {
        status: HttpStatus.PRECONDITION_FAILED,
        title: "Draft changed",
        detail: "The draft is not at the revision you sent",
      },
    ],
    [
      NameRefusal.WorkflowExists,
      {
        status: HttpStatus.CONFLICT,
        title: "Workflow exists",
        detail: "A workflow of this name exists already; open it to edit it",
      },
    ],
    [
      ImportRefusal.Unreachable,
      {
        status: HttpStatus.BAD_GATEWAY,
        title: "Import unreachable",
        detail: "The import's server could not be reached",
      },
    ],
    [
      ImportRefusal.Rejected,
      {
        status: HttpStatus.BAD_GATEWAY,
        title: "Import refused",
        detail: "The import's server refused to give its text",
      },
    ],
    [
      ImportRefusal.Unauthenticated,
      {
        status: HttpStatus.BAD_GATEWAY,
        title: "Import unauthenticated",
        detail: "The import's authorization server refused the credentials",
      },
    ],
    [
      ImportRefusal.Misconfigured,
      {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        title: "Import misconfigured",
        detail: "The import cannot be fetched with this address or secret",
      },
    ],
    [
      ImportRefusal.Expired,
      {
        status: HttpStatus.GATEWAY_TIMEOUT,
        title: "Import timed out",
        detail: "The import's server did not answer within the time limit",
      },
    ],
    [
      Missing.Workflow,
      {
        status: HttpStatus.NOT_FOUND,
        title: "Workflow not found",
        detail: "The workflow does not exist",
      },
    ],
    [
      Missing.Version,
      {
        status: HttpStatus.NOT_FOUND,
        title: "Version not found",
        detail: "The workflow version does not exist",
      },
    ],
    [
      Missing.Instance,
      {
        status: HttpStatus.NOT_FOUND,
        title: "Run not found",
        detail: "The workflow instance does not exist",
      },
    ],
    [
      Missing.Secret,
      {
        status: HttpStatus.NOT_FOUND,
        title: "Secret not found",
        detail: "The secret does not exist",
      },
    ],
    [
      Missing.Subscription,
      {
        status: HttpStatus.NOT_FOUND,
        title: "Notification not found",
        detail: "The subscription does not exist",
      },
    ],
    [
      Missing.Webhook,
      {
        status: HttpStatus.NOT_FOUND,
        title: "Webhook not found",
        detail: "The webhook does not exist",
      },
    ],
    [
      Missing.Structure,
      {
        status: HttpStatus.NOT_FOUND,
        title: "Structure unavailable",
        detail: "The version no longer analyses, so it has no structure",
      },
    ],
    [
      Missing.Draft,
      {
        status: HttpStatus.NOT_FOUND,
        title: "Draft not found",
        detail: "The workflow has no draft",
      },
    ],
    [
      Missing.TaskOutput,
      {
        status: HttpStatus.NOT_FOUND,
        title: "Output not kept",
        detail: "The task has no output kept",
      },
    ],
    [
      AccountRefusal.InvalidCredentials,
      {
        status: HttpStatus.UNAUTHORIZED,
        title: "Sign-in refused",
        detail: "Invalid email or password",
      },
    ],
    [
      AccountRefusal.WrongPassword,
      {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        title: "Wrong password",
        detail: "The current password is wrong",
      },
    ],
    [
      UserRefusal.Suspended,
      {
        status: HttpStatus.FORBIDDEN,
        title: "Account suspended",
        detail: "The account is suspended",
      },
    ],
    [
      InvitationRefusal.Accepted,
      {
        status: HttpStatus.GONE,
        title: "Invitation accepted",
        detail: "The invitation has already been accepted",
      },
    ],
    [
      InvitationRefusal.Revoked,
      {
        status: HttpStatus.GONE,
        title: "Invitation revoked",
        detail: "The invitation has been revoked",
      },
    ],
    [
      InvitationRefusal.Expired,
      {
        status: HttpStatus.GONE,
        title: "Invitation expired",
        detail: "The invitation has expired",
      },
    ],
    [
      InvitationRefusal.EmailTaken,
      {
        status: HttpStatus.CONFLICT,
        title: "Email taken",
        detail: "An account with this email address already exists",
      },
    ],
    [
      IdentityMissing.User,
      {
        status: HttpStatus.NOT_FOUND,
        title: "User not found",
        detail: "The user does not exist",
      },
    ],
    [
      IdentityMissing.Invitation,
      {
        status: HttpStatus.NOT_FOUND,
        title: "Invitation not found",
        detail: "The invitation does not exist",
      },
    ],
  ]);

  of(failure: Failure): HttpException {
    if (typeof failure === "object") return this.#invalidDefinition(failure);

    const problem = this.problemOf(failure);
    return this.#exceptionOf(problem);
  }

  detailed(refusal: Refusal, detail: string): HttpException {
    const described = this.problemOf(refusal);
    const problem = {
      type: described.type,
      title: described.title,
      status: described.status,
      detail,
    };
    return this.#exceptionOf(problem);
  }

  ofSubscription(
    failure:
      readonly DefinitionProblem[] | SubscriptionRefusal | EndpointRefusal,
  ): HttpException {
    if (typeof failure === "string") return this.of(failure);

    const type = `${ProblemPresenter.TYPE}${ProblemPresenter.SUBSCRIPTION_INVALID}`;
    const detail = this.#detailOf(failure);
    const errors = failure.map((problem) => ({
      pointer: `${ProblemPresenter.FILTER}${problem.pointer}`,
      detail: problem.detail,
    }));
    const invalid: ProblemDetails = {
      type,
      title: "The subscription is invalid",
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      detail,
      errors,
    };
    return new UnprocessableEntityException(invalid);
  }

  ofStart(failure: Refusal | readonly InputProblem[]): HttpException {
    if (typeof failure === "string") return this.of(failure);

    const type = `${ProblemPresenter.TYPE}${ProblemPresenter.INPUT_INVALID}`;
    const errors = failure.map((problem) => ({
      pointer: `${ProblemPresenter.INPUT}${problem.pointer}`,
      detail: problem.detail,
    }));
    const invalid: ProblemDetails = {
      type,
      title: "Input refused",
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      detail: "The input does not match the workflow's input schema",
      errors,
    };
    return new UnprocessableEntityException(invalid);
  }

  problemOf(refusal: Refusal): ProblemDetails {
    const described = ProblemPresenter.DESCRIBED.get(refusal);

    if (described === undefined)
      throw new TypeError(`No problem describes ${refusal}`);

    const type = `${ProblemPresenter.TYPE}${refusal}`;
    return {
      type,
      title: described.title,
      status: described.status,
      detail: described.detail,
    };
  }

  #invalidDefinition(problems: readonly DefinitionProblem[]): HttpException {
    const type = `${ProblemPresenter.TYPE}${ProblemPresenter.DEFINITION_INVALID}`;
    const detail = this.#detailOf(problems);
    const errors = problems.map((problem) => ({
      code: problem.code,
      pointer: problem.pointer,
      detail: problem.detail,
      line: problem.line,
      column: problem.column,
    }));
    const invalid: ProblemDetails = {
      type,
      title: "The workflow definition is invalid",
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      detail,
      errors,
    };
    return new UnprocessableEntityException(invalid);
  }

  #detailOf(problems: readonly DefinitionProblem[]): string {
    const details = problems.map((problem) => problem.detail);
    return details.join(ProblemPresenter.SEPARATOR);
  }

  #exceptionOf(problem: ProblemDetails): HttpException {
    const Exception = ProblemPresenter.EXCEPTIONS.get(problem.status);

    if (Exception === undefined) {
      const status = String(problem.status);
      throw new TypeError(`No exception answers ${status}`);
    }

    return new Exception(problem);
  }
}
