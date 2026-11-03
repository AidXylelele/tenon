import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { ProblemException } from './problem.exception.js';

// RFC 9457 names its own media type for a problem.
@Catch(ProblemException)
export class ProblemFilter implements ExceptionFilter<ProblemException> {
  private static readonly MEDIA_TYPE = 'application/problem+json';

  catch(exception: ProblemException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const problem = exception.problem;
    response
      .status(problem.status)
      .type(ProblemFilter.MEDIA_TYPE)
      .json(problem);
  }
}
