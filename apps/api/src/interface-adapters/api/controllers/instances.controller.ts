import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { Idempotent } from '@nestjs/idempotency';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EventQueries } from '../../../application/automation/events/queries.js';
import { CancelInstance } from '../../../application/automation/instances/cancel-instance.js';
import { EventsQuery } from '../schemas/event.schemas.js';
import { DeleteInstance } from '../../../application/automation/instances/delete-instance.js';
import { InstancePolicy } from '../../../application/automation/instances/instance.policy.js';
import type { InstanceResult } from '../../../application/automation/instances/ports.js';
import { InstanceQueries } from '../../../application/automation/instances/queries.js';
import { RestartInstance } from '../../../application/automation/instances/restart-instance.js';
import { ResumeInstance } from '../../../application/automation/instances/resume-instance.js';
import { StartInstance } from '../../../application/automation/instances/start-instance.js';
import { SuspendInstance } from '../../../application/automation/instances/suspend-instance.js';
import { WorkflowName } from '../../../domain/automation/workflows/workflow-name.js';
import type { User } from '../../../domain/identity/user.js';
import { CursorMapper } from '../mappers/cursor.mapper.js';
import { InstancePresenter } from '../presenters/instance.presenter.js';
import { Missing } from '../../../application/automation/enums.js';
import { ProblemFilter } from '../filters/problem.filter.js';
import { ProblemPresenter } from '../presenters/problem.presenter.js';
import {
  InstancePageResponse,
  InstanceParams,
  InstanceResponse,
  InstanceSummaryResponse,
  LATEST,
  ListInstancesQuery,
  EventPageResponse,
  type ResponseJson,
  StartInstanceBody,
  TaskPageResponse,
  TasksQuery,
} from '../schemas/instance.schemas.js';
import { WorkflowParams } from '../schemas/workflow.schemas.js';

// A start repeats another when it names the same version and input once defaults apply: an
// omitted input is `{}`, an omitted version `latest` (FR-009).
function startFingerprint(body: unknown): unknown {
  const parsed = StartInstanceBody.safeParse(body);
  return parsed.success ? parsed.data : body;
}

@ApiTags('instances')
@ApiCookieAuth('sessionCookie')
@UseFilters(ProblemFilter)
@Controller()
export class InstancesController {
  constructor(
    private readonly startInstance: StartInstance,
    private readonly restartInstance: RestartInstance,
    private readonly cancelInstance: CancelInstance,
    private readonly suspendInstance: SuspendInstance,
    private readonly resumeInstance: ResumeInstance,
    private readonly deleteInstance: DeleteInstance,
    private readonly instances: InstanceQueries,
    private readonly eventQueries: EventQueries,
  ) {}

  // A repeated request with the same Idempotency-Key answers the first one's response (FR-009).
  @Post('workflows/:namespace/:name/instances')
  @Can(InstancePolicy, 'operate')
  @Idempotent({ fingerprint: startFingerprint })
  @ApiCreatedResponse({ standardSchema: InstanceSummaryResponse })
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  async start(
    @Param({ schema: WorkflowParams }) params: WorkflowParams,
    @Body({ schema: StartInstanceBody }) body: StartInstanceBody,
    @CurrentUser() user: User,
  ): Promise<InstanceSummaryResponse> {
    const name = new WorkflowName(params.namespace, params.name);
    const version = body.version === LATEST ? null : body.version;
    const started = await this.startInstance.execute({
      name,
      version,
      input: body.input,
      starterId: user.id,
    });

    if (!started.ok) throw ProblemPresenter.of(started.failure);

    return this.#summaryOf(started.value.id);
  }

  @Get('instances')
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: InstancePageResponse })
  async list(
    @Query({ schema: ListInstancesQuery }) query: ListInstancesQuery,
  ): Promise<InstancePageResponse> {
    const startedFrom =
      query.startedFrom === undefined ? null : new Date(query.startedFrom);
    const startedTo =
      query.startedTo === undefined ? null : new Date(query.startedTo);
    const filter = {
      namespace: query.namespace ?? null,
      name: query.name ?? null,
      version: query.version ?? null,
      phase: query.phase ?? null,
      startedFrom,
      startedTo,
    };
    const after = CursorMapper.toInstancePosition(query.cursor);
    const page = await this.instances.list(filter, after, query.limit);
    return InstancePresenter.page(page);
  }

  @Get('instances/:id')
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: InstanceResponse })
  @ApiNotFoundResponse()
  async get(
    @Param({ schema: InstanceParams }) params: InstanceParams,
  ): Promise<InstanceResponse> {
    const instance = await this.instances.get(params.id);

    if (instance === null) throw ProblemPresenter.of(Missing.Instance);

    return InstancePresenter.instance(instance);
  }

  // The instance's progress: its task executions in the order they began.
  @Get('instances/:id/tasks')
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: TaskPageResponse })
  @ApiNotFoundResponse()
  async tasks(
    @Param({ schema: InstanceParams }) params: InstanceParams,
    @Query({ schema: TasksQuery }) query: TasksQuery,
  ): Promise<TaskPageResponse> {
    const after = query.cursor ?? null;
    const page = await this.instances.tasks(params.id, after, query.limit);

    if (page === null) throw ProblemPresenter.of(Missing.Instance);

    return InstancePresenter.tasks(page);
  }

  // The instance's lifecycle events and the events it emitted, in the order accepted (FR-016).
  @Get('instances/:id/events')
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: EventPageResponse })
  @ApiNotFoundResponse()
  async events(
    @Param({ schema: InstanceParams }) params: InstanceParams,
    @Query({ schema: EventsQuery }) query: EventsQuery,
  ): Promise<EventPageResponse> {
    const after = query.cursor ?? null;
    const page = await this.eventQueries.ofInstance(
      params.id,
      after,
      query.limit,
    );

    if (page === null) throw ProblemPresenter.of(Missing.Instance);

    const next = page.next === null ? null : String(page.next);
    return { items: page.items as ResponseJson[], next };
  }

  @Post('instances/:id/cancel')
  @Can(InstancePolicy, 'operate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiConflictResponse()
  async cancel(
    @Param({ schema: InstanceParams }) params: InstanceParams,
  ): Promise<void> {
    const cancelled = await this.cancelInstance.execute({
      instanceId: params.id,
    });
    InstancesController.refusedUnless(cancelled);
  }

  @Post('instances/:id/suspend')
  @Can(InstancePolicy, 'operate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiConflictResponse()
  async suspend(
    @Param({ schema: InstanceParams }) params: InstanceParams,
  ): Promise<void> {
    const suspended = await this.suspendInstance.execute({
      instanceId: params.id,
    });
    InstancesController.refusedUnless(suspended);
  }

  @Post('instances/:id/resume')
  @Can(InstancePolicy, 'operate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiConflictResponse()
  async resume(
    @Param({ schema: InstanceParams }) params: InstanceParams,
  ): Promise<void> {
    const resumed = await this.resumeInstance.execute({
      instanceId: params.id,
    });
    InstancesController.refusedUnless(resumed);
  }

  @Post('instances/:id/restart')
  @Can(InstancePolicy, 'operate')
  @ApiCreatedResponse({ standardSchema: InstanceSummaryResponse })
  @ApiConflictResponse()
  async restart(
    @Param({ schema: InstanceParams }) params: InstanceParams,
    @CurrentUser() user: User,
  ): Promise<InstanceSummaryResponse> {
    const restarted = await this.restartInstance.execute({
      instanceId: params.id,
      starterId: user.id,
    });

    if (!restarted.ok) throw ProblemPresenter.of(restarted.failure);

    return this.#summaryOf(restarted.value.id);
  }

  @Delete('instances/:id')
  @Can(InstancePolicy, 'operate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiConflictResponse()
  async delete(
    @Param({ schema: InstanceParams }) params: InstanceParams,
  ): Promise<void> {
    const deleted = await this.deleteInstance.execute({
      instanceId: params.id,
    });
    InstancesController.refusedUnless(deleted);
  }

  async #summaryOf(id: string): Promise<InstanceSummaryResponse> {
    const instance = await this.instances.get(id);

    if (instance === null) throw ProblemPresenter.of(Missing.Instance);

    return InstancePresenter.summary(instance);
  }

  private static refusedUnless(result: InstanceResult): void {
    if (!result.ok) throw ProblemPresenter.of(result.failure);
  }
}
