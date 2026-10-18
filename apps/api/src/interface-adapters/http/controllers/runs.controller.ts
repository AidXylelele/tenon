import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Transactional } from '@nestjs-cls/transactional';
import { CancelRun } from '../../../application/use-cases/cancel-run.js';
import { GetRun } from '../../../application/use-cases/get-run.js';
import { ListRuns } from '../../../application/use-cases/list-runs.js';
import { ReadStepOutput } from '../../../application/use-cases/read-step-output.js';
import { StartManualRun } from '../../../application/use-cases/start-manual-run.js';
import { StartTestRun } from '../../../application/use-cases/start-test-run.js';
import type { Run } from '../../../domain/run.js';
import type { User } from '../../../domain/user.js';
import { RunLauncher } from '../../workflows/run-launcher.js';
import {
  QueuedRunResponse,
  RunPageResponse,
  RunResponse,
  StepOutputPageResponse,
} from '../dto/automation-responses.dto.js';
import { ListRunsQuery } from '../dto/list-runs.query.js';
import { StartRunDto } from '../dto/start-run.dto.js';
import { StepOutputQuery } from '../dto/step-output.query.js';
import { RunPresenter } from '../presenters/run.presenter.js';

@ApiTags('runs')
@ApiCookieAuth('sessionCookie')
@Controller()
export class RunsController {
  static readonly PAGE_SIZE = 25;
  static readonly OUTPUT_PAGE_SIZE = 50;

  constructor(
    private readonly startTestRun: StartTestRun,
    private readonly startManualRun: StartManualRun,
    private readonly cancelRun: CancelRun,
    private readonly getRun: GetRun,
    private readonly listRuns: ListRuns,
    private readonly readStepOutput: ReadStepOutput,
    private readonly launcher: RunLauncher,
  ) {}

  @Post('runs')
  @Can.Anyone()
  @Transactional()
  @HttpCode(202)
  @ApiAcceptedResponse({ type: QueuedRunResponse })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse({
    description:
      'Nodes have configuration problems, or the node is not a trigger',
  })
  async start(
    @Body() dto: StartRunDto,
    @CurrentUser() user: User,
  ): Promise<QueuedRunResponse> {
    const run = await this.started(dto, user);
    await this.launcher.launch(run);
    return RunPresenter.queued(run);
  }

  @Get('runs/:runId')
  @Can.Anyone()
  @Header('Cache-Control', 'no-cache')
  @ApiOkResponse({ type: RunResponse })
  @ApiNotFoundResponse()
  async get(
    @Param('runId', ParseUUIDPipe) runId: string,
  ): Promise<RunResponse> {
    const run = await this.getRun.execute(runId);
    return RunPresenter.run(run);
  }

  @Post('runs/:runId/cancel')
  @Can.Anyone()
  @HttpCode(202)
  @ApiAcceptedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'The run already finished' })
  async cancel(
    @Param('runId', ParseUUIDPipe) runId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    const run = await this.cancelled(runId, user);
    await this.launcher.cancel(run);
  }

  @Get('runs/:runId/steps/:nodeId/output')
  @Can.Anyone()
  @ApiOkResponse({ type: StepOutputPageResponse })
  @ApiNotFoundResponse()
  @ApiServiceUnavailableResponse({
    description: 'Object storage is temporarily unavailable',
  })
  async output(
    @Param('runId', ParseUUIDPipe) runId: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @Query() query: StepOutputQuery,
  ): Promise<StepOutputPageResponse> {
    const port = query.port ?? 'main';
    const offset = query.offset ?? 0;
    const limit = query.limit ?? RunsController.OUTPUT_PAGE_SIZE;
    const page = await this.readStepOutput.execute({
      runId,
      nodeId,
      port,
      offset,
      limit,
    });
    return RunPresenter.output(page);
  }

  @Get('workflows/:id/runs')
  @Can.Anyone()
  @ApiTags('runs')
  @ApiOkResponse({ type: RunPageResponse })
  @ApiNotFoundResponse()
  async list(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListRunsQuery,
  ): Promise<RunPageResponse> {
    const status = query.status ?? null;
    const cursor = query.cursor ?? null;
    const limit = query.limit ?? RunsController.PAGE_SIZE;
    const page = await this.listRuns.execute(id, { status, cursor, limit });
    return RunPresenter.page(page);
  }

  private started(dto: StartRunDto, user: User): Promise<Run> {
    const items = dto.items ?? [];
    const { draft, release } = dto.target;

    if (draft) {
      return this.startTestRun.execute({
        actor: user,
        workflowId: dto.workflowId,
        revision: draft.revision,
        triggerNodeId: dto.triggerNodeId,
        items,
      });
    }

    const releaseNumber = release ?? 0;
    return this.startManualRun.execute({
      actor: user,
      workflowId: dto.workflowId,
      releaseNumber,
      triggerNodeId: dto.triggerNodeId,
      items,
    });
  }

  @Transactional()
  private cancelled(runId: string, user: User): Promise<Run> {
    return this.cancelRun.execute({ actor: user, runId });
  }
}
