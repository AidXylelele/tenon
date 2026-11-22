import { AutomationPolicy } from "../auth/automation.policy.js";
import { CurrentUser } from "@nestjs/authentication";
import { Can } from "@nestjs/authorization";
import {
  Body,
  Controller,
  Headers,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { Idempotent } from "@nestjs/idempotency";
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { TestDraft } from "../../../application/automation/drafts/test-draft.js";
import { Missing } from "../../../application/automation/enums.js";
import { InstanceQueries } from "../../../application/automation/instances/queries.js";
import { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type { User } from "../../../domain/identity/users/user.js";
import { EntityTagMapper } from "../mappers/entity-tag.mapper.js";
import { DraftPresenter } from "../presenters/draft.presenter.js";
import { InstancePresenter } from "../presenters/instance.presenter.js";
import { ProblemPresenter } from "../presenters/problem.presenter.js";
import {
  DraftConflictResponse,
  TestRunBody,
  TestRunFingerprint,
} from "../schemas/draft.schema.js";
import { InstanceSummaryResponse } from "../schemas/instance.schema.js";
import {
  DefinitionProblemsResponse,
  WorkflowParams,
} from "../schemas/workflow.schema.js";

@ApiTags("drafts")
@ApiCookieAuth("sessionCookie")
@Controller("workflows/:namespace/:name/draft/test-runs")
export class TestRunsController {
  constructor(
    private readonly testDraft: TestDraft,
    private readonly instances: InstanceQueries,
    private readonly instancePresenter: InstancePresenter,
    private readonly draftPresenter: DraftPresenter,
    private readonly problemPresenter: ProblemPresenter,
    private readonly entityTagMapper: EntityTagMapper,
  ) {}

  @Post()
  @Can(AutomationPolicy, "change")
  @Idempotent({
    fingerprint: (body: unknown) => TestRunFingerprint.parse(body),
  })
  @ApiHeader({ name: "If-Match", required: true })
  @ApiCreatedResponse({ standardSchema: InstanceSummaryResponse })
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
  async create(
    @Param({ schema: WorkflowParams }) params: WorkflowParams,
    @Body({ schema: TestRunBody }) body: TestRunBody,
    @Headers("if-match") ifMatch: string | undefined,
    @CurrentUser() user: User,
  ): Promise<InstanceSummaryResponse> {
    const name = new WorkflowName(params.namespace, params.name);
    const precondition = this.entityTagMapper.toWritePrecondition(
      ifMatch,
      undefined,
    );

    if (precondition.kind !== "match")
      throw this.draftPresenter.preconditionRequired();

    const tested = await this.testDraft.execute({
      name,
      expected: precondition.revision,
      input: body.input,
      starterId: user.id,
    });

    if (!tested.ok) throw this.draftPresenter.testRefusalOf(tested.failure);

    const instance = await this.instances.get(tested.value.instanceId);

    if (instance === null) throw this.problemPresenter.of(Missing.Instance);

    return this.instancePresenter.summary(instance);
  }
}
