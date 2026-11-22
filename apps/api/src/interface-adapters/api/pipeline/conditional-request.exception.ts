import { HttpException } from "@nestjs/common";
import type { ProblemDetails, ResponseHeaders } from "./interfaces.js";

export class ConditionalRequestException extends HttpException {
  readonly headers: ResponseHeaders;

  constructor(problem: ProblemDetails, headers: ResponseHeaders) {
    super(problem, problem.status);
    this.headers = headers;
  }
}
