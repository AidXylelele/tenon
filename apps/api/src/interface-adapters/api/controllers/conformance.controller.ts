import { Can } from '@nestjs/authorization';
import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GetConformanceStatement } from '../../../application/automation/workflows/get-conformance-statement.js';
import { WorkflowPresenter } from '../presenters/workflow.presenter.js';
import { ConformanceResponse } from '../schemas/workflow.schemas.js';

@ApiTags('conformance')
@ApiCookieAuth('sessionCookie')
@Controller('conformance')
export class ConformanceController {
  constructor(
    private readonly getConformanceStatement: GetConformanceStatement,
  ) {}

  @Get()
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: ConformanceResponse })
  statement(): ConformanceResponse {
    const statement = this.getConformanceStatement.execute();
    return WorkflowPresenter.conformance(statement);
  }
}
