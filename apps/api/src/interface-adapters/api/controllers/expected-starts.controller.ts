import { Can } from "@nestjs/authorization";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ListExpectedStarts } from "../../../application/automation/schedules/list-expected-starts.js";
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
    private readonly listExpectedStarts: ListExpectedStarts,
    private readonly workflowPresenter: WorkflowPresenter,
  ) {}

  @Get()
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: ExpectedStartsResponse })
  async list(
    @Query({ schema: ExpectedStartsQuery }) query: ExpectedStartsQuery,
  ): Promise<ExpectedStartsResponse> {
    const command = { from: query.from };
    const expected = await this.listExpectedStarts.execute(command);
    return this.workflowPresenter.expectedStarts(expected);
  }
}
