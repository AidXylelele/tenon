import { HttpException } from '@nestjs/common';

export interface ProblemLocation {
  readonly pointer: string;
  readonly detail: string;
}

// An RFC 9457 problem: `type` names the kind of problem, `errors` locates it in the request.
export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly errors?: readonly ProblemLocation[];
}

export class ProblemException extends HttpException {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem, problem.status);
    this.problem = problem;
  }
}
