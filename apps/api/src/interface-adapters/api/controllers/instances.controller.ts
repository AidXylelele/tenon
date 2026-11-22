import { AutomationPolicy } from "../auth/automation.policy.js";
import { CurrentUser } from "@nestjs/authentication";
import { Can } from "@nestjs/authorization";
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { Idempotent } from "@nestjs/idempotency";
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { EventQueries } from "../../../application/automation/events/queries.js";
import { CancelInstance } from "../../../application/automation/instances/cancel-instance.js";
import { EventsQuery } from "../schemas/event.schema.js";
import { DeleteInstance } from "../../../application/automation/instances/delete-instance.js";
import type { InstanceResult } from "../../../application/automation/instances/interfaces.js";
import { InstanceQueries } from "../../../application/automation/instances/queries.js";
import { RestartInstance } from "../../../application/automation/instances/restart-instance.js";
import { ResumeInstance } from "../../../application/automation/instances/resume-instance.js";
import { StartInstance } from "../../../application/automation/instances/start-instance.js";
import { SuspendInstance } from "../../../application/automation/instances/suspend-instance.js";
import { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type { User } from "../../../domain/identity/users/user.js";
import { InstancePresenter } from "../presenters/instance.presenter.js";
import { Missing } from "../../../application/automation/enums.js";
import { ProblemPresenter } from "../presenters/problem.presenter.js";
import {
  InstanceCountsQuery,
  InstanceCountsResponse,
  InstancePageResponse,
  InstanceParams,
  InstanceResponse,
  InstanceSummaryResponse,
  LATEST,
  ListInstancesQuery,
  ResponseJson,
  EventPageResponse,
  StartFingerprint,
  StartInstanceBody,
  TaskOutputParams,
  TaskPageResponse,
  TasksQuery,
} from "../schemas/instance.schema.js";
import { WorkflowParams } from "../schemas/workflow.schema.js";

@ApiTags("instances")
@ApiCookieAuth("sessionCookie")
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
    private readonly instancePresenter: InstancePresenter,
    private readonly problemPresenter: ProblemPresenter,
  ) {}

  @Post("workflows/:namespace/:name/instances")
  @Can(AutomationPolicy, "change")
  @Idempotent({ fingerprint: (body: unknown) => StartFingerprint.parse(body) })
  @ApiCreatedResponse({ standardSchema: InstanceSummaryResponse })
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
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

    if (!started.ok) throw this.problemPresenter.ofStart(started.failure);

    return this.#summaryOf(started.value.instanceId);
  }

  @Get("instances")
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: InstancePageResponse })
  async list(
    @Query({ schema: ListInstancesQuery }) query: ListInstancesQuery,
  ): Promise<InstancePageResponse> {
    const filter = {
      namespace: query.namespace ?? null,
      name: query.name ?? null,
      version: query.version ?? null,
      phases: query.phase ?? [],
      from: query.from ?? null,
      to: query.to ?? null,
      tests: query.tests,
    };
    const page = await this.instances.list({
      filter,
      order: query.sort,
      page: query.page,
      limit: query.limit,
    });
    return this.instancePresenter.page(page);
  }

  @Get("instance-counts")
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: InstanceCountsResponse })
  async counts(
    @Query({ schema: InstanceCountsQuery }) query: InstanceCountsQuery,
  ): Promise<InstanceCountsResponse> {
    const window = {
      buckets: query.bucket,
      to: query.to,
      previousFrom: query.previousFrom ?? null,
      namespace: query.namespace ?? null,
      name: query.name ?? null,
      tests: query.tests,
    };
    const counted = await this.instances.counts(window);
    return this.instancePresenter.counts(counted);
  }

  @Get("instances/:id")
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: InstanceResponse })
  @ApiNotFoundResponse()
  async get(
    @Param({ schema: InstanceParams }) params: InstanceParams,
  ): Promise<InstanceResponse> {
    const instance = await this.instances.get(params.id);

    if (instance === null) throw this.problemPresenter.of(Missing.Instance);

    return this.instancePresenter.detail(instance);
  }

  @Get("instances/:id/tasks")
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: TaskPageResponse })
  @ApiNotFoundResponse()
  async tasks(
    @Param({ schema: InstanceParams }) params: InstanceParams,
    @Query({ schema: TasksQuery }) query: TasksQuery,
  ): Promise<TaskPageResponse> {
    const after = query.cursor ?? null;
    const page = await this.instances.tasks(params.id, after, query.limit);

    if (page === null) throw this.problemPresenter.of(Missing.Instance);

    return this.instancePresenter.tasks(page);
  }

  @Get("instances/:id/tasks/:execution/output")
  @Can.Anyone()
  @Header("Content-Type", "application/json")
  @ApiOkResponse({ standardSchema: ResponseJson })
  @ApiNotFoundResponse()
  async taskOutput(
    @Param({ schema: TaskOutputParams }) params: TaskOutputParams,
  ): Promise<string> {
    const output = await this.instances.taskOutput(params.id, params.execution);

    if (output === null) throw this.problemPresenter.of(Missing.TaskOutput);

    return this.instancePresenter.output(output);
  }

  @Get("instances/:id/events")
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

    if (page === null) throw this.problemPresenter.of(Missing.Instance);

    return this.instancePresenter.events(page);
  }

  @Post("instances/:id/cancel")
  @Can(AutomationPolicy, "change")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiConflictResponse()
  async cancel(
    @Param({ schema: InstanceParams }) params: InstanceParams,
  ): Promise<void> {
    const cancelled = await this.cancelInstance.execute({
      instanceId: params.id,
      signal: null,
    });
    this.#refusedUnless(cancelled);
  }

  @Post("instances/:id/suspend")
  @Can(AutomationPolicy, "change")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiConflictResponse()
  async suspend(
    @Param({ schema: InstanceParams }) params: InstanceParams,
  ): Promise<void> {
    const suspended = await this.suspendInstance.execute({
      instanceId: params.id,
    });
    this.#refusedUnless(suspended);
  }

  @Post("instances/:id/resume")
  @Can(AutomationPolicy, "change")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiConflictResponse()
  async resume(
    @Param({ schema: InstanceParams }) params: InstanceParams,
  ): Promise<void> {
    const resumed = await this.resumeInstance.execute({
      instanceId: params.id,
    });
    this.#refusedUnless(resumed);
  }

  @Post("instances/:id/restart")
  @Can(AutomationPolicy, "change")
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

    if (!restarted.ok) throw this.problemPresenter.of(restarted.failure);

    return this.#summaryOf(restarted.value.instanceId);
  }

  @Delete("instances/:id")
  @Can(AutomationPolicy, "change")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiConflictResponse()
  async delete(
    @Param({ schema: InstanceParams }) params: InstanceParams,
  ): Promise<void> {
    const deleted = await this.deleteInstance.execute({
      instanceId: params.id,
    });
    this.#refusedUnless(deleted);
  }

  async #summaryOf(id: string): Promise<InstanceSummaryResponse> {
    const instance = await this.instances.get(id);

    if (instance === null) throw this.problemPresenter.of(Missing.Instance);

    return this.instancePresenter.summary(instance);
  }

  #refusedUnless(result: InstanceResult): void {
    if (!result.ok) throw this.problemPresenter.of(result.failure);
  }
}
