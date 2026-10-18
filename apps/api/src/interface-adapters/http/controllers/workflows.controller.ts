import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Transactional } from '@nestjs-cls/transactional';
import { WorkflowPolicy } from '../../../application/policies/workflow.policy.js';
import { ArchiveWorkflow } from '../../../application/use-cases/archive-workflow.js';
import { CreateWorkflow } from '../../../application/use-cases/create-workflow.js';
import { DuplicateWorkflow } from '../../../application/use-cases/duplicate-workflow.js';
import { GetWorkflow } from '../../../application/use-cases/get-workflow.js';
import { ListWorkflows } from '../../../application/use-cases/list-workflows.js';
import { PinSample } from '../../../application/use-cases/pin-sample.js';
import { RenameWorkflow } from '../../../application/use-cases/rename-workflow.js';
import { RestoreWorkflow } from '../../../application/use-cases/restore-workflow.js';
import { SaveDraft } from '../../../application/use-cases/save-draft.js';
import { TransferWorkflow } from '../../../application/use-cases/transfer-workflow.js';
import { UnpinSample } from '../../../application/use-cases/unpin-sample.js';
import type { User } from '../../../domain/user.js';
import {
  NodeSampleResponse,
  SavedDraftResponse,
  WorkflowPageResponse,
  WorkflowResponse,
  WorkflowSummaryResponse,
} from '../dto/automation-responses.dto.js';
import { DuplicateWorkflowDto } from '../dto/duplicate-workflow.dto.js';
import { SaveDraftDto } from '../dto/graph.dto.js';
import { PinnedItemsDto } from '../dto/items.dto.js';
import { ListWorkflowsQuery } from '../dto/list-workflows.query.js';
import { TransferWorkflowDto } from '../dto/transfer-workflow.dto.js';
import { WorkflowNameDto } from '../dto/workflow-name.dto.js';
import { DraftMapper } from '../mappers/draft.mapper.js';
import { WorkflowPresenter } from '../presenters/workflow.presenter.js';

@ApiTags('workflows')
@ApiCookieAuth('sessionCookie')
@Controller('workflows')
export class WorkflowsController {
  static readonly PAGE_SIZE = 25;

  constructor(
    private readonly createWorkflow: CreateWorkflow,
    private readonly renameWorkflow: RenameWorkflow,
    private readonly saveDraft: SaveDraft,
    private readonly pinSample: PinSample,
    private readonly unpinSample: UnpinSample,
    private readonly archiveWorkflow: ArchiveWorkflow,
    private readonly restoreWorkflow: RestoreWorkflow,
    private readonly duplicateWorkflow: DuplicateWorkflow,
    private readonly transferWorkflow: TransferWorkflow,
    private readonly getWorkflow: GetWorkflow,
    private readonly listWorkflows: ListWorkflows,
  ) {}

  @Get()
  @Can.Anyone()
  @ApiOkResponse({ type: WorkflowPageResponse })
  async list(
    @Query() query: ListWorkflowsQuery,
  ): Promise<WorkflowPageResponse> {
    const search = query.search ?? null;
    const ownerId = query.owner ?? null;
    const archived = query.archived ?? false;
    const cursor = query.cursor ?? null;
    const limit = query.limit ?? WorkflowsController.PAGE_SIZE;
    const page = await this.listWorkflows.execute({
      search,
      ownerId,
      archived,
      cursor,
      limit,
    });
    return WorkflowPresenter.page(page);
  }

  @Post()
  @Can(WorkflowPolicy, 'author')
  @Transactional()
  @HttpCode(201)
  @ApiCreatedResponse({ type: WorkflowResponse })
  @ApiForbiddenResponse()
  async create(
    @Body() dto: WorkflowNameDto,
    @CurrentUser() user: User,
  ): Promise<WorkflowResponse> {
    const workflow = await this.createWorkflow.execute({
      actor: user,
      name: dto.name,
    });
    return this.details(user, workflow.id);
  }

  @Get(':id')
  @Can.Anyone()
  @ApiOkResponse({ type: WorkflowResponse })
  @ApiNotFoundResponse()
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<WorkflowResponse> {
    return this.details(user, id);
  }

  @Patch(':id')
  @Can.Anyone()
  @Transactional()
  @ApiOkResponse({ type: WorkflowSummaryResponse })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  async rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WorkflowNameDto,
    @CurrentUser() user: User,
  ): Promise<WorkflowSummaryResponse> {
    await this.renameWorkflow.execute({
      actor: user,
      workflowId: id,
      name: dto.name,
    });
    const details = await this.getWorkflow.execute({
      actor: user,
      workflowId: id,
    });
    return WorkflowPresenter.summary(details.workflow);
  }

  @Put(':id/draft')
  @Can.Anyone()
  @Transactional()
  @ApiOkResponse({ type: SavedDraftResponse })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse({ description: 'The graph is malformed' })
  async replaceDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveDraftDto,
    @CurrentUser() user: User,
  ): Promise<SavedDraftResponse> {
    const graph = DraftMapper.graph(dto.graph);
    const settings = DraftMapper.settings(dto.settings);
    const saved = await this.saveDraft.execute({
      actor: user,
      workflowId: id,
      revision: dto.revision,
      graph,
      settings,
    });
    return WorkflowPresenter.saved(saved);
  }

  @Put(':id/samples/:nodeId')
  @Can.Anyone()
  @Transactional()
  @ApiOkResponse({ type: NodeSampleResponse })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async pin(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @Body() dto: PinnedItemsDto,
    @CurrentUser() user: User,
  ): Promise<NodeSampleResponse> {
    await this.pinSample.execute({
      actor: user,
      workflowId: id,
      nodeId,
      items: dto.items,
    });
    const details = await this.getWorkflow.execute({
      actor: user,
      workflowId: id,
    });
    const stored = details.workflow.samples.find(
      (candidate) => candidate.nodeId === nodeId,
    );
    const sample = stored ?? { nodeId, pinned: true, fields: [] };
    return WorkflowPresenter.sample(sample);
  }

  @Delete(':id/samples/:nodeId')
  @Can.Anyone()
  @Transactional()
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  unpin(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.unpinSample.execute({ actor: user, workflowId: id, nodeId });
  }

  @Post(':id/archive')
  @Can.Anyone()
  @Transactional()
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.archiveWorkflow.execute({ actor: user, workflowId: id });
  }

  @Post(':id/restore')
  @Can.Anyone()
  @Transactional()
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.restoreWorkflow.execute({ actor: user, workflowId: id });
  }

  @Post(':id/duplicate')
  @Can(WorkflowPolicy, 'author')
  @Transactional()
  @HttpCode(201)
  @ApiCreatedResponse({ type: WorkflowResponse })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateWorkflowDto,
    @CurrentUser() user: User,
  ): Promise<WorkflowResponse> {
    const name = dto.name ?? null;
    const copy = await this.duplicateWorkflow.execute({
      actor: user,
      workflowId: id,
      name,
    });
    return this.details(user, copy.id);
  }

  @Post(':id/transfer')
  @Can.Anyone()
  @Transactional()
  @HttpCode(200)
  @ApiOkResponse({ type: WorkflowResponse })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description: 'The new owner is not an active editor or administrator',
  })
  async transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferWorkflowDto,
    @CurrentUser() user: User,
  ): Promise<WorkflowResponse> {
    await this.transferWorkflow.execute({
      actor: user,
      workflowId: id,
      ownerId: dto.ownerId,
    });
    return this.details(user, id);
  }

  private async details(
    user: User,
    workflowId: string,
  ): Promise<WorkflowResponse> {
    const details = await this.getWorkflow.execute({ actor: user, workflowId });
    return WorkflowPresenter.details(details);
  }
}
