import { type HttpException, HttpStatus, Injectable } from "@nestjs/common";
import type {
  DraftConflict,
  DraftView,
  RefusedInput,
} from "../../../application/automation/drafts/interfaces.js";
import { DraftRefusal } from "../../../domain/automation/drafts/enums.js";
import type { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import { ConditionalRequestException } from "../pipeline/conditional-request.exception.js";
import type {
  ProblemDetails,
  ResponseHeaders,
} from "../pipeline/interfaces.js";
import { EntityTagMapper } from "../mappers/entity-tag.mapper.js";
import type { DraftLayout, DraftResponse } from "../schemas/draft.schema.js";
import type { Failure } from "./interfaces.js";
import { ProblemPresenter } from "./problem.presenter.js";
import { ApiRoute } from "../enums.js";

@Injectable()
export class DraftPresenter {
  private static readonly PREFIX = `/${ApiRoute.Prefix}/workflows`;
  private static readonly REVALIDATE = "private, no-cache";
  private static readonly UNSTORED = "no-store";
  private static readonly PRECONDITION_REQUIRED =
    "urn:problem:draft.precondition-required";

  constructor(
    private readonly problemPresenter: ProblemPresenter,
    private readonly entityTagMapper: EntityTagMapper,
  ) {}

  draft(view: DraftView): DraftResponse {
    const savedBy = { id: view.savedBy.id, name: view.savedBy.name };
    return {
      source: view.source,
      layout: view.layout as DraftLayout,
      savedBy,
      savedAt: view.savedAt.toISOString(),
    };
  }

  headersOf(view: DraftView): ResponseHeaders {
    const etag = this.entityTagMapper.fromRevision(view.revision);
    return { ETag: etag, "Cache-Control": DraftPresenter.REVALIDATE };
  }

  locationOf(name: WorkflowName): string {
    const namespace = encodeURIComponent(name.namespace);
    const workflow = encodeURIComponent(name.name);
    return `${DraftPresenter.PREFIX}/${namespace}/${workflow}/draft`;
  }

  refusalOf(failure: DraftConflict | Failure): HttpException {
    const conflict = this.#isConflict(failure);

    if (conflict) return this.conflict(failure);

    return this.problemPresenter.of(failure);
  }

  testRefusalOf(
    failure: DraftConflict | RefusedInput | Failure,
  ): HttpException {
    const refusedInput = this.#isRefusedInput(failure);

    if (refusedInput)
      return this.problemPresenter.ofStart(failure.inputProblems);

    return this.refusalOf(failure);
  }

  conflict(failure: DraftConflict): HttpException {
    if (failure.current === null)
      return this.problemPresenter.of(failure.refusal);

    const described = this.problemPresenter.problemOf(failure.refusal);
    const current = this.draft(failure.current);
    const etag = this.entityTagMapper.fromRevision(failure.current.revision);
    const problem: ProblemDetails = {
      type: described.type,
      title: described.title,
      status: described.status,
      detail: described.detail,
      current,
    };
    const headers = { ETag: etag };
    return new ConditionalRequestException(problem, headers);
  }

  lostRace(): HttpException {
    return this.problemPresenter.of(DraftRefusal.Stale);
  }

  preconditionRequired(): HttpException {
    const problem: ProblemDetails = {
      type: DraftPresenter.PRECONDITION_REQUIRED,
      title: "The draft's revision is required",
      status: HttpStatus.PRECONDITION_REQUIRED,
      detail:
        "Send If-Match with the draft's ETag to save, publish or discard it, or If-None-Match: * to create it",
    };
    const headers = { "Cache-Control": DraftPresenter.UNSTORED };
    return new ConditionalRequestException(problem, headers);
  }

  #isConflict(failure: DraftConflict | Failure): failure is DraftConflict {
    return typeof failure === "object" && "refusal" in failure;
  }

  #isRefusedInput(
    failure: DraftConflict | RefusedInput | Failure,
  ): failure is RefusedInput {
    return typeof failure === "object" && "inputProblems" in failure;
  }
}
