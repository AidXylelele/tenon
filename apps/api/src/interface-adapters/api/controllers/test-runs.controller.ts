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
import { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type { User } from "../../../domain/identity/users/user.js";
import { EntityTagMapper } from "../mappers/entity-tag.mapper.js";
import { DraftPresenter } from "../presenters/draft.presenter.js";
import { InstanceReadBack } from "../read-backs/instance.read-back.js";
import {
  DraftConflictResponse,
  TestRunBody,
  TestRunFingerprint,
  TestRunProblemsResponse,
} from "../schemas/draft.schema.js";
import { InstanceSummaryResponse } from "../schemas/instance.schema.js";
import { WorkflowParams } from "../schemas/workflow.schema.js";

@ApiTags("drafts")
@ApiCookieAuth("sessionCookie")
@Controller("workflows/:namespace/:name/draft/test-runs")
export class TestRunsController {
  constructor(
    private readonly testDraft: TestDraft,
    private readonly instanceReadBack: InstanceReadBack,
    private readonly draftPresenter: DraftPresenter,
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
  @ApiUnprocessableEntityResponse({ standardSchema: TestRunProblemsResponse })
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

    return this.instanceReadBack.summaryOf(tested.value.instanceId);
  }
}
