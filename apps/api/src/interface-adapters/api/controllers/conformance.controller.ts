import { Can } from '@nestjs/authorization';
import { Controller, Get, UseFilters } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DefinitionChecker } from '../../../application/automation/workflows/ports.js';
import { ProblemFilter } from '../filters/problem.filter.js';
import { ConformanceResponse } from '../schemas/conformance.schemas.js';

// The platform's statement of partial conformance to DSL 1.0.3 (ER-001): what publish holds a
// document to.
@ApiTags('conformance')
@ApiCookieAuth('sessionCookie')
@UseFilters(ProblemFilter)
@Controller('conformance')
export class ConformanceController {
  constructor(private readonly checker: DefinitionChecker) {}

  @Get()
  @Can.Anyone()
  @ApiOkResponse({ standardSchema: ConformanceResponse })
  statement(): ConformanceResponse {
    const view = this.checker.statement();
    return {
      dsl: view.dsl.slice(),
      tasks: view.tasks.slice(),
      calls: view.calls.slice(),
      runs: view.runs.slice(),
      scriptLanguages: view.scriptLanguages.slice(),
      authentications: view.authentications.slice(),
      excluded: view.excluded.slice(),
      contradictions: view.contradictions.slice(),
    };
  }
}
