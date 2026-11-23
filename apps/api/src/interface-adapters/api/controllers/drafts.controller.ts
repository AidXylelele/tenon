import { AutomationPolicy } from "../auth/automation.policy.js";
import { CurrentUser } from "@nestjs/authentication";
import { Can } from "@nestjs/authorization";
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CreateDraft } from "../../../application/automation/drafts/create-draft.js";
import { DiscardDraft } from "../../../application/automation/drafts/discard-draft.js";
import { PublishDraft } from "../../../application/automation/drafts/publish-draft.js";
import { DraftQueries } from "../../../application/automation/drafts/queries.js";
import { SaveDraft } from "../../../application/automation/drafts/save-draft.js";
import { Missing } from "../../../application/automation/enums.js";
import type {
  PublishedVersion,
  VersionSummary,
} from "../../../application/automation/workflows/interfaces.js";
import { WorkflowQueries } from "../../../application/automation/workflows/queries.js";
import { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type { User } from "../../../domain/identity/users/user.js";
import { StaleDraftInterceptor } from "../pipeline/stale-draft.interceptor.js";
import { EntityTagMapper } from "../mappers/entity-tag.mapper.js";
import { DraftPresenter } from "../presenters/draft.presenter.js";
import { ProblemPresenter } from "../presenters/problem.presenter.js";
import { WorkflowPresenter } from "../presenters/workflow.presenter.js";
import {
  DraftBody,
  DraftConflictResponse,
  DraftResponse,
} from "../schemas/draft.schema.js";
import {
  DefinitionProblemsResponse,
  VersionResponse,
  WorkflowParams,
} from "../schemas/workflow.schema.js";

@ApiTags("drafts")
@ApiCookieAuth("sessionCookie")
@Controller("workflows/:namespace/:name/draft")
export class DraftsController {
  constructor(
    private readonly createDraft: CreateDraft,
    private readonly saveDraft: SaveDraft,
    private readonly publishDraft: PublishDraft,
    private readonly discardDraft: DiscardDraft,
    private readonly drafts: DraftQueries,
    private readonly workflows: WorkflowQueries,
    private readonly draftPresenter: DraftPresenter,
    private readonly workflowPresenter: WorkflowPresenter,
    private readonly problemPresenter: ProblemPresenter,
    private readonly entityTagMapper: EntityTagMapper,
  ) {}

  @Get()
  @Can(AutomationPolicy, "change")
  @ApiHeader({ name: "If-None-Match", required: false })
  @ApiOkResponse({ standardSchema: DraftResponse })
  @ApiResponse({ status: HttpStatus.NOT_MODIFIED })
  @ApiNotFoundResponse()
  async read(
    @Param({ schema: WorkflowParams }) params: WorkflowParams,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DraftResponse | undefined> {
    const name = new WorkflowName(params.namespace, params.name);
    const draft = await this.drafts.find(name);

    if (draft === null) throw this.problemPresenter.of(Missing.Draft);

    const headers = this.draftPresenter.headersOf(draft);
    response.set(headers);
    const unchanged = this.entityTagMapper.isUnchanged(
      ifNoneMatch,
      draft.revision,
    );

    if (!unchanged) return this.draftPresenter.draft(draft);

    response.status(HttpStatus.NOT_MODIFIED);
    return undefined;
  }

  @Put()
  @Can(AutomationPolicy, "change")
  @UseInterceptors(StaleDraftInterceptor)
  @ApiHeader({ name: "If-Match", required: false })
  @ApiHeader({ name: "If-None-Match", required: false })
  @ApiOkResponse({ standardSchema: DraftResponse })
  @ApiCreatedResponse({ standardSchema: DraftResponse })
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiResponse({
    status: HttpStatus.PRECONDITION_FAILED,
    standardSchema: DraftConflictResponse,
  })
  @ApiResponse({ status: HttpStatus.PRECONDITION_REQUIRED })
  async write(
    @Param({ schema: WorkflowParams }) params: WorkflowParams,
    @Body({ schema: DraftBody }) body: DraftBody,
    @Headers("if-match") ifMatch: string | undefined,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DraftResponse> {
    const name = new WorkflowName(params.namespace, params.name);
    const author = { id: user.id, name: user.name };
    const precondition = this.entityTagMapper.toWritePrecondition(
      ifMatch,
      ifNoneMatch,
    );

    if (precondition.kind === "required")
      throw this.draftPresenter.preconditionRequired();

    if (precondition.kind === "create") {
      const created = await this.createDraft.execute({
        name,
        source: body.source,
        layout: body.layout,
        author,
      });

      if (!created.ok) throw this.draftPresenter.refusalOf(created.failure);

      const location = this.draftPresenter.locationOf(name);
      const headers = this.draftPresenter.headersOf(created.value);
      response.status(HttpStatus.CREATED).location(location).set(headers);
      return this.draftPresenter.draft(created.value);
    }

    const saved = await this.saveDraft.execute({
      name,
      expected: precondition.revision,
      source: body.source,
      layout: body.layout,
      author,
    });

    if (!saved.ok) throw this.draftPresenter.conflict(saved.failure);

    const headers = this.draftPresenter.headersOf(saved.value);
    response.set(headers);
    return this.draftPresenter.draft(saved.value);
  }

  @Post()
  @Can(AutomationPolicy, "change")
  @ApiHeader({ name: "If-Match", required: true })
  @ApiCreatedResponse({ standardSchema: VersionResponse })
  @ApiOkResponse({ standardSchema: VersionResponse })
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiResponse({
    status: HttpStatus.PRECONDITION_FAILED,
    standardSchema: DraftConflictResponse,
  })
  @ApiResponse({ status: HttpStatus.PRECONDITION_REQUIRED })
  @ApiUnprocessableEntityResponse({
    standardSchema: DefinitionProblemsResponse,
  })
  async publish(
    @Param({ schema: WorkflowParams }) params: WorkflowParams,
    @Headers("if-match") ifMatch: string | undefined,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ): Promise<VersionResponse> {
    const name = new WorkflowName(params.namespace, params.name);
    const precondition = this.entityTagMapper.toWritePrecondition(
      ifMatch,
      undefined,
    );

    if (precondition.kind !== "match")
      throw this.draftPresenter.preconditionRequired();

    const published = await this.publishDraft.execute({
      name,
      expected: precondition.revision,
      publisherId: user.id,
    });

    if (!published.ok) throw this.draftPresenter.refusalOf(published.failure);

    const status = this.workflowPresenter.statusOf(published.value);
    const location = this.workflowPresenter.locationOf(published.value);
    const version = await this.#publishedOf(published.value);
    response.status(status).location(location);
    return this.workflowPresenter.version(version);
  }

  @Delete()
  @Can(AutomationPolicy, "change")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiHeader({ name: "If-Match", required: true })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiResponse({
    status: HttpStatus.PRECONDITION_FAILED,
    standardSchema: DraftConflictResponse,
  })
  @ApiResponse({ status: HttpStatus.PRECONDITION_REQUIRED })
  async discard(
    @Param({ schema: WorkflowParams }) params: WorkflowParams,
    @Headers("if-match") ifMatch: string | undefined,
  ): Promise<void> {
    const name = new WorkflowName(params.namespace, params.name);
    const precondition = this.entityTagMapper.toWritePrecondition(
      ifMatch,
      undefined,
    );

    if (precondition.kind !== "match")
      throw this.draftPresenter.preconditionRequired();

    const discarded = await this.discardDraft.execute({
      name,
      expected: precondition.revision,
    });

    if (!discarded.ok) throw this.draftPresenter.refusalOf(discarded.failure);
  }

  async #publishedOf(published: PublishedVersion): Promise<VersionSummary> {
    const name = new WorkflowName(published.namespace, published.name);
    const version = await this.workflows.version(name, published.version);

    if (version === null) throw this.problemPresenter.of(Missing.Version);

    return version;
  }
}
