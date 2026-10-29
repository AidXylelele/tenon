import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { CheckDocument } from '../../../application/automation/workflows/check-document.js';
import { PublishVersion } from '../../../application/automation/workflows/publish-version.js';
import { WorkflowQueries } from '../../../application/automation/workflows/queries.js';
import { WorkflowPolicy } from '../../../application/automation/workflows/workflow.policy.js';
import { WorkflowName } from '../../../domain/automation/language/workflow-name.js';
import {
  VersionNotFoundError,
  WorkflowNotFoundError,
} from '../../../domain/errors.js';
import type { User } from '../../../domain/identity/user.js';
import {
  DslDocument,
  mediaTypeOf,
  type SubmittedDocument,
} from '../parsers/dsl-document.parser.js';
import { WorkflowPresenter } from '../presenters/workflow.presenter.js';
import {
  CheckReportResponse,
  ListWorkflowsQuery,
  VersionParams,
  VersionResponse,
  WorkflowPageResponse,
  WorkflowParams,
  WorkflowResponse,
} from '../schemas/workflow.schemas.js';

@ApiTags('workflows')
@ApiCookieAuth('sessionCookie')
@Controller('workflows')
export class WorkflowsController {
  constructor(
    private readonly checkDocument: CheckDocument,
    private readonly publishVersion: PublishVersion,
    private readonly workflows: WorkflowQueries,
  ) {}

  @Post('check')
  @Can(WorkflowPolicy, 'author')
  @HttpCode(200)
  @ApiOkResponse({ standardSchema: CheckReportResponse })
  async check(
    @DslDocument() document: SubmittedDocument,
  ): Promise<CheckReportResponse> {
    const report = await this.checkDocument.execute(document);
    return WorkflowPresenter.report(report);
  }

  @Post()
  @Can(WorkflowPolicy, 'author')
  @ApiCreatedResponse({ standardSchema: VersionResponse })
  @ApiOkResponse({ standardSchema: VersionResponse })
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
  async publish(
    @DslDocument() document: SubmittedDocument,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ): Promise<VersionResponse> {
    const published = await this.publishVersion.execute({
      format: document.format,
      text: document.text,
      publisherId: user.id,
    });
    const status = published.created ? 201 : 200;
    response.status(status);
    return WorkflowPresenter.published(published);
  }

  @Get()
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: WorkflowPageResponse })
  async list(
    @Query({ schema: ListWorkflowsQuery }) query: ListWorkflowsQuery,
  ): Promise<WorkflowPageResponse> {
    const cursor = query.cursor ?? null;
    const page = await this.workflows.list({ cursor, limit: query.limit });
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

    if (workflow === null) throw new WorkflowNotFoundError();

    return WorkflowPresenter.workflow(workflow);
  }

  @Get(':namespace/:name/versions')
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: z.array(VersionResponse) })
  async versions(
    @Param({ schema: WorkflowParams }) params: WorkflowParams,
  ): Promise<VersionResponse[]> {
    const workflowName = new WorkflowName(params.namespace, params.name);
    const versions = await this.workflows.versions(workflowName);
    return versions.map((version) => WorkflowPresenter.version(version));
  }

  @Get(':namespace/:name/versions/:version')
  @Can.Anyone()
  @ApiOkResponse({ description: 'The document exactly as submitted' })
  @ApiNotFoundResponse()
  async document(
    @Param({ schema: VersionParams }) params: VersionParams,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const workflowName = new WorkflowName(params.namespace, params.name);
    const document = await this.workflows.document(
      workflowName,
      params.version,
    );

    if (document === null) throw new VersionNotFoundError();

    const mediaType = mediaTypeOf(document.format);
    response.type(mediaType);
    return document.text;
  }
}
