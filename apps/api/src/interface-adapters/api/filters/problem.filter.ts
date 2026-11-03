import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ProblemDetails } from './problem.exception.js';
import { ProblemException } from './problem.exception.js';

interface NestErrorBody {
  readonly error?: string;
  readonly message?: string | readonly string[];
  readonly code?: string;
  readonly type?: string;
}

// Every refusal of the automation routes is an RFC 9457 problem in its own media type: the
// refusals the use cases name keep their type, and the rest (validation, authorization, a
// reused Idempotency-Key) are `about:blank` problems titled by their status (RFC 9457 4.2.1).
@Catch(HttpException)
export class ProblemFilter implements ExceptionFilter<HttpException> {
  private static readonly MEDIA_TYPE = 'application/problem+json';
  private static readonly BLANK = 'about:blank';

  catch(exception: HttpException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const problem = ProblemFilter.problemOf(exception);
    response
      .status(problem.status)
      .type(ProblemFilter.MEDIA_TYPE)
      .json(problem);
  }

  private static problemOf(exception: HttpException): ProblemDetails {
    if (exception instanceof ProblemException) return exception.problem;

    const status = exception.getStatus();
    const answered = exception.getResponse();
    const body: NestErrorBody =
      typeof answered === 'string' ? { message: answered } : answered;

    // A problem replayed for a repeated Idempotency-Key comes back as the body it answered.
    if (typeof body.type === 'string') return answered as ProblemDetails;

    const title = body.error ?? exception.name;
    const message = body.message ?? title;
    const detail = typeof message === 'string' ? message : message.join('; ');
    const problem: ProblemDetails = {
      type: ProblemFilter.BLANK,
      title,
      status,
      detail,
    };

    if (body.code === undefined) return problem;

    return { type: problem.type, title, status, detail, code: body.code };
  }
}
