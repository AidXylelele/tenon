import { AutomationPolicy } from "../auth/automation.policy.js";
import { CurrentUser } from "@nestjs/authentication";
import { Can } from "@nestjs/authorization";
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import { TurnWorkflowOff } from "../../../application/automation/workflows/turn-workflow-off.js";
import { TurnWorkflowOn } from "../../../application/automation/workflows/turn-workflow-on.js";
import { ArchiveWorkflow } from "../../../application/automation/workflows/archive-workflow.js";
import { CheckDefinition } from "../../../application/automation/workflows/check-definition.js";
import { WorkflowQueries } from "../../../application/automation/workflows/queries.js";
import type { JsonObject } from "../../../domain/automation/interfaces.js";
import { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type { User } from "../../../domain/identity/user.js";
import {
  StructureClient,
  type VersionStructure,
} from "../../workflows/interfaces.js";
import { EntityTagMapper } from "../mappers/entity-tag.mapper.js";
import { Missing } from "../../../application/automation/enums.js";
import { ProblemPresenter } from "../presenters/problem.presenter.js";
import { WorkflowPresenter } from "../presenters/workflow.presenter.js";
import {
  DefinitionBody,
  DefinitionProblemsResponse,
  ListWorkflowsQuery,
  VersionParams,
  VersionListResponse,
  VersionSourceResponse,
  WorkflowPageResponse,
  WorkflowParams,
  WorkflowResponse,
} from "../schemas/workflow.schemas.js";

@ApiTags("workflows")
@ApiCookieAuth("sessionCookie")
@Controller("workflows")
export class WorkflowsController {
  constructor(
    private readonly checkDefinition: CheckDefinition,
    private readonly archiveWorkflow: ArchiveWorkflow,
    private readonly turnWorkflowOn: TurnWorkflowOn,
    private readonly turnWorkflowOff: TurnWorkflowOff,
    private readonly workflows: WorkflowQueries,
    private readonly structures: StructureClient,
    private readonly workflowPresenter: WorkflowPresenter,
    private readonly problemPresenter: ProblemPresenter,
    private readonly entityTagMapper: EntityTagMapper,
  ) {}

  @Post("check")
  @Can(AutomationPolicy, "change")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse({
    standardSchema: DefinitionProblemsResponse,
  })
  async check(
    @Body({ schema: DefinitionBody }) document: DefinitionBody,
    @CurrentUser() user: User,
  ): Promise<void> {
    const checked = await this.checkDefinition.execute({
      document,
      publisherId: user.id,
    });

    if (!checked.ok) throw this.problemPresenter.of(checked.failure);
  }

  @Get()
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: WorkflowPageResponse })
  async list(
    @Query({ schema: ListWorkflowsQuery }) query: ListWorkflowsQuery,
  ): Promise<WorkflowPageResponse> {
    const after = query.cursor ?? null;
    const status = query.status ?? null;
    const search = query.q ?? null;
    const page = await this.workflows.list({
      after,
      status,
      search,
      limit: query.limit,
    });
    return this.workflowPresenter.page(page);
  }

  @Get(":namespace/:name")
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: WorkflowResponse })
  @ApiNotFoundResponse()
  async get(
    @Param({ schema: WorkflowParams }) params: WorkflowParams,
  ): Promise<WorkflowResponse> {
    const workflowName = new WorkflowName(params.namespace, params.name);
    const workflow = await this.workflows.get(workflowName);

    if (workflow === null) throw this.problemPresenter.of(Missing.Workflow);

    return this.workflowPresenter.workflow(workflow);
  }

  @Post(":namespace/:name/archive")
  @Can(AutomationPolicy, "change")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async archive(
    @Param({ schema: WorkflowParams }) params: WorkflowParams,
  ): Promise<void> {
    const name = new WorkflowName(params.namespace, params.name);
    const archived = await this.archiveWorkflow.execute({ name });

    if (!archived.ok) throw this.problemPresenter.of(archived.failure);
  }

  @Post(":namespace/:name/turn-on")
  @Can(AutomationPolicy, "change")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  async turnOn(
    @Param({ schema: WorkflowParams }) params: WorkflowParams,
  ): Promise<void> {
    const name = new WorkflowName(params.namespace, params.name);
    const turned = await this.turnWorkflowOn.execute({ name });

    if (!turned.ok) throw this.problemPresenter.of(turned.failure);
  }

  @Post(":namespace/:name/turn-off")
  @Can(AutomationPolicy, "change")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async turnOff(
    @Param({ schema: WorkflowParams }) params: WorkflowParams,
  ): Promise<void> {
    const name = new WorkflowName(params.namespace, params.name);
    const turned = await this.turnWorkflowOff.execute({ name });

    if (!turned.ok) throw this.problemPresenter.of(turned.failure);
  }

  @Get(":namespace/:name/versions")
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: VersionListResponse })
  @ApiNotFoundResponse()
  async versions(
    @Param({ schema: WorkflowParams }) params: WorkflowParams,
  ): Promise<VersionListResponse> {
    const workflowName = new WorkflowName(params.namespace, params.name);
    const versions = await this.workflows.versions(workflowName);

    if (versions === null) throw this.problemPresenter.of(Missing.Workflow);

    return this.workflowPresenter.versions(versions);
  }

  @Get(":namespace/:name/versions/:version")
  @Can.Anyone()
  @ApiOkResponse({ description: "The published document, as JSON" })
  @ApiNotFoundResponse()
  async document(
    @Param({ schema: VersionParams }) params: VersionParams,
  ): Promise<JsonObject> {
    const workflowName = new WorkflowName(params.namespace, params.name);
    const document = await this.workflows.document(
      workflowName,
      params.version,
    );

    if (document === null) throw this.problemPresenter.of(Missing.Version);

    return document;
  }

  @Get(":namespace/:name/versions/:version/source")
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: VersionSourceResponse })
  @ApiNotFoundResponse()
  async source(
    @Param({ schema: VersionParams }) params: VersionParams,
  ): Promise<VersionSourceResponse> {
    const workflowName = new WorkflowName(params.namespace, params.name);
    const source = await this.workflows.source(workflowName, params.version);

    if (source === null) throw this.problemPresenter.of(Missing.Version);

    return { source: source.source };
  }

  @Get(":namespace/:name/versions/:version/structure")
  @Can.Anyone()
  @ApiOkResponse({
    description:
      "The version's steps, as the editor reads them, with its summary and input schema",
  })
  @ApiResponse({ status: HttpStatus.NOT_MODIFIED })
  @ApiNotFoundResponse()
  async structure(
    @Param({ schema: VersionParams }) params: VersionParams,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<VersionStructure | undefined> {
    const workflowName = new WorkflowName(params.namespace, params.name);
    const program = await this.workflows.program(workflowName, params.version);

    if (program === null) throw this.problemPresenter.of(Missing.Version);

    const tag = this.structures.tagOf(program);
    const digest = this.entityTagMapper.digestOf({ tag });
    const etag = this.entityTagMapper.fromRevision(digest);
    const unchanged = this.entityTagMapper.isUnchanged(ifNoneMatch, digest);

    if (unchanged) {
      response.set({ ETag: etag, "Cache-Control": "private, no-cache" });
      response.status(HttpStatus.NOT_MODIFIED);
      return undefined;
    }

    const structure = await this.structures.structureOf(program);

    if (structure === null) throw this.problemPresenter.of(Missing.Structure);

    response.set({ ETag: etag, "Cache-Control": "private, no-cache" });
    return structure;
  }
}
