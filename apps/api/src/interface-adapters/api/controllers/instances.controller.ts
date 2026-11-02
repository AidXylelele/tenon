import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Idempotent } from '@nestjs/idempotency';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { InstancePolicy } from '../../../application/automation/instances/instance.policy.js';
import {
  type InstanceFilter,
  InstanceQueries,
} from '../../../application/automation/instances/queries.js';
import { StartInstance } from '../../../application/automation/instances/start-instance.js';
import { WorkflowName } from '../../../domain/automation/language/workflow-name.js';
import { WorkflowTarget } from '../../../domain/automation/language/workflow-target.js';
import { InstanceNotFoundError } from '../../../domain/errors.js';
import type { User } from '../../../domain/identity/user.js';
import { CursorMapper } from '../mappers/cursor.mapper.js';
import { StartKeyMapper } from '../mappers/start-key.mapper.js';
import { InstancePresenter } from '../presenters/instance.presenter.js';
import {
  CloudEventPageResponse,
  InstanceParams,
  InstancePageResponse,
  InstanceResponse,
  InstanceSummaryResponse,
  ListInstancesQuery,
  PageQuery,
  StartInstanceBody,
  TaskRecordPageResponse,
} from '../schemas/instance.schemas.js';
import { WorkflowParams } from '../schemas/workflow.schemas.js';

@ApiTags('instances')
@ApiCookieAuth('sessionCookie')
@Controller()
export class InstancesController {
  constructor(
    private readonly startInstance: StartInstance,
    private readonly instances: InstanceQueries,
  ) {}

  @Post('workflows/:namespace/:name/instances')
  @Can(InstancePolicy, 'operate')
  @Idempotent()
  @ApiCreatedResponse({ standardSchema: InstanceSummaryResponse })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
  async start(
    @Param({ schema: WorkflowParams }) params: WorkflowParams,
    @Body({ schema: StartInstanceBody }) body: StartInstanceBody,
    @Headers('idempotency-key') key: string | undefined,
    @CurrentUser() user: User,
  ): Promise<InstanceSummaryResponse> {
    const workflow = new WorkflowName(params.namespace, params.name);
    const version = body.version ?? null;
    const target = WorkflowTarget.of(workflow, version);
    const startKey = StartKeyMapper.toKey(key, target, body.input);
    const instance = await this.startInstance.execute({
      target,
      input: body.input,
      userId: user.id,
      key: startKey,
    });
    return InstancePresenter.started(instance);
  }

  @Get('instances')
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: InstancePageResponse })
  @ApiBadRequestResponse()
  async list(
    @Query({ schema: ListInstancesQuery }) query: ListInstancesQuery,
  ): Promise<InstancePageResponse> {
    const filter: InstanceFilter = {
      namespace: query.namespace ?? null,
      name: query.name ?? null,
      version: query.version ?? null,
      phase: query.phase ?? null,
      startedFrom: query.startedFrom ?? null,
      startedTo: query.startedTo ?? null,
    };
    const after = CursorMapper.toInstancePosition(query.cursor);
    const page = await this.instances.list(filter, {
      after,
      limit: query.limit,
    });
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

    if (instance === null) throw new InstanceNotFoundError();

    return InstancePresenter.instance(instance);
  }

  @Get('instances/:id/tasks')
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: TaskRecordPageResponse })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  async tasks(
    @Param({ schema: InstanceParams }) params: InstanceParams,
    @Query({ schema: PageQuery }) query: PageQuery,
  ): Promise<TaskRecordPageResponse> {
    const exists = await this.instances.exists(params.id);

    if (!exists) throw new InstanceNotFoundError();

    const after = CursorMapper.toPosition(query.cursor);
    const page = await this.instances.tasks(params.id, {
      after,
      limit: query.limit,
    });
    return InstancePresenter.tasks(page);
  }

  @Get('instances/:id/events')
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: CloudEventPageResponse })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  async events(
    @Param({ schema: InstanceParams }) params: InstanceParams,
    @Query({ schema: PageQuery }) query: PageQuery,
  ): Promise<CloudEventPageResponse> {
    const exists = await this.instances.exists(params.id);

    if (!exists) throw new InstanceNotFoundError();

    const after = CursorMapper.toPosition(query.cursor);
    const page = await this.instances.lifecycleEvents(params.id, {
      after,
      limit: query.limit,
    });
    return InstancePresenter.events(page);
  }
}
