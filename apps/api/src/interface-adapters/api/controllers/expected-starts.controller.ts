import { Can } from "@nestjs/authorization";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ScheduleQueries } from "../../../application/automation/schedules/queries.js";
import { WorkflowPresenter } from "../presenters/workflow.presenter.js";
import {
  ExpectedStartsQuery,
  ExpectedStartsResponse,
} from "../schemas/workflow.schema.js";

@ApiTags("workflows")
@ApiCookieAuth("sessionCookie")
@Controller("expected-starts")
export class ExpectedStartsController {
  constructor(
    private readonly schedules: ScheduleQueries,
    private readonly workflowPresenter: WorkflowPresenter,
  ) {}

  @Get()
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: ExpectedStartsResponse })
  async list(
    @Query({ schema: ExpectedStartsQuery }) query: ExpectedStartsQuery,
  ): Promise<ExpectedStartsResponse> {
    const expected = await this.schedules.expected(query.from);
    return this.workflowPresenter.expectedStarts(expected);
  }
}
