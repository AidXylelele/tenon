import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseFilters,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { ArchiveWorkflow } from '../../../application/automation/workflows/archive-workflow.js';
import { CheckDefinition } from '../../../application/automation/workflows/check-definition.js';
import { PublishVersion } from '../../../application/automation/workflows/publish-version.js';
import { WorkflowQueries } from '../../../application/automation/workflows/queries.js';
import { WorkflowPolicy } from '../../../application/automation/workflows/workflow.policy.js';
import type { JsonObject } from '../../../domain/automation/json.js';
import { WorkflowName } from '../../../domain/automation/workflows/workflow-name.js';
import type { User } from '../../../domain/identity/user.js';
import { CursorMapper } from '../mappers/cursor.mapper.js';
import { Missing } from '../../../application/automation/enums.js';
import { ProblemFilter } from '../filters/problem.filter.js';
import { ProblemPresenter } from '../presenters/problem.presenter.js';
import { WorkflowPresenter } from '../presenters/workflow.presenter.js';
import {
  DefinitionBody,
  ListWorkflowsQuery,
  VersionParams,
  VersionResponse,
  WorkflowPageResponse,
  WorkflowParams,
  WorkflowResponse,
} from '../schemas/workflow.schemas.js';

@ApiTags('workflows')
@ApiCookieAuth('sessionCookie')
@UseFilters(ProblemFilter)
@Controller('workflows')
export class WorkflowsController {
  constructor(
    private readonly checkDefinition: CheckDefinition,
    private readonly publishVersion: PublishVersion,
    private readonly archiveWorkflow: ArchiveWorkflow,
    private readonly workflows: WorkflowQueries,
  ) {}

  @Post('check')
  @Can(WorkflowPolicy, 'author')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
  async check(
    @Body({ schema: DefinitionBody }) document: DefinitionBody,
    @CurrentUser() user: User,
  ): Promise<void> {
    const checked = await this.checkDefinition.execute({
      document,
      publisherId: user.id,
    });

    if (!checked.ok) throw ProblemPresenter.of(checked.failure);
  }

  @Post()
  @Can(WorkflowPolicy, 'author')
  @ApiCreatedResponse({ standardSchema: VersionResponse })
  @ApiOkResponse({ standardSchema: VersionResponse })
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
  async publish(
    @Body({ schema: DefinitionBody }) document: DefinitionBody,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ): Promise<VersionResponse> {
    const published = await this.publishVersion.execute({
      document,
      publisherId: user.id,
    });

    if (!published.ok) throw ProblemPresenter.of(published.failure);

    const status = WorkflowPresenter.statusOf(published.value);
    const location = WorkflowPresenter.locationOf(published.value);
    response.status(status).location(location);
    return WorkflowPresenter.published(published.value);
  }

  @Get()
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: WorkflowPageResponse })
  async list(
    @Query({ schema: ListWorkflowsQuery }) query: ListWorkflowsQuery,
  ): Promise<WorkflowPageResponse> {
    const after = CursorMapper.toWorkflowPosition(query.cursor);
    const status = query.status ?? null;
    const page = await this.workflows.list({
      after,
      status,
      limit: query.limit,
    });
    return WorkflowPresenter.page(page);
  }

  @Get(':namespace/:name')
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: WorkflowResponse })
  @ApiNotFoundResponse()
  async get(
    @Param({ schema: WorkflowParams }) params: WorkflowParams,
  ): Promise<WorkflowResponse> {
    const workflowName = new WorkflowName(params.namespace, params.name);
    const workflow = await this.workflows.get(workflowName);

    if (workflow === null) throw ProblemPresenter.of(Missing.Workflow);

    return WorkflowPresenter.workflow(workflow);
  }

  @Post(':namespace/:name/archive')
  @Can(WorkflowPolicy, 'author')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async archive(
    @Param({ schema: WorkflowParams }) params: WorkflowParams,
  ): Promise<void> {
    const name = new WorkflowName(params.namespace, params.name);
    const archived = await this.archiveWorkflow.execute({ name });

    if (!archived.ok) throw ProblemPresenter.of(archived.failure);
  }

  @Get(':namespace/:name/versions')
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: z.array(VersionResponse) })
  @ApiNotFoundResponse()
  async versions(
    @Param({ schema: WorkflowParams }) params: WorkflowParams,
  ): Promise<VersionResponse[]> {
    const workflowName = new WorkflowName(params.namespace, params.name);
    const versions = await this.workflows.versions(workflowName);

    if (versions === null) throw ProblemPresenter.of(Missing.Workflow);

    return versions.map((version) => WorkflowPresenter.version(version));
  }

  @Get(':namespace/:name/versions/:version')
  @Can.Anyone()
  @ApiOkResponse({ description: 'The published document, as JSON' })
  @ApiNotFoundResponse()
  async document(
    @Param({ schema: VersionParams }) params: VersionParams,
  ): Promise<JsonObject> {
    const workflowName = new WorkflowName(params.namespace, params.name);
    const document = await this.workflows.document(
      workflowName,
      params.version,
    );

    if (document === null) throw ProblemPresenter.of(Missing.Version);

    return document;
  }
}
