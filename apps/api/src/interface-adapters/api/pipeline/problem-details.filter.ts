import {
  type ArgumentsHost,
  Catch,
  ConflictException,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import {
  BulkheadFullError,
  CircuitOpenError,
  OutboundRateLimitError,
} from "@nestjs/resilience";
import { STATUS_CODES } from "node:http";
import { StaleWriteError } from "../../../domain/stale-write.error.js";
import { ConditionalRequestException } from "./conditional-request.exception.js";
import type {
  NestErrorBody,
  ProblemDetails,
  ResponseHeaders,
  Shed,
} from "./interfaces.js";

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private static readonly HTTP = "http";
  private static readonly RETRY_AFTER = "Retry-After";
  private static readonly SOON_MS = 1_000;
  private static readonly INTERNAL =
    "The platform failed while answering; try again later";
  private static readonly MEDIA_TYPE = "application/problem+json";
  private static readonly BLANK = "about:blank";
  private static readonly SEPARATOR = "; ";
  private static readonly NO_HEADERS: ResponseHeaders = {};
  private static readonly UNEXPLAINED = "The request could not be answered";
  private static readonly SENTENCES = new Map<number, string>([
    [HttpStatus.BAD_REQUEST, "The request is not valid"],
    [HttpStatus.UNAUTHORIZED, "Sign in to continue"],
    [HttpStatus.FORBIDDEN, "You are not allowed to do this"],
    [HttpStatus.NOT_FOUND, "Nothing is found at this address"],
    [HttpStatus.METHOD_NOT_ALLOWED, "This address does not take that method"],
    [HttpStatus.CONFLICT, "The request conflicts with what is stored"],
    [HttpStatus.PAYLOAD_TOO_LARGE, "The request is too large"],
    [
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      "The request's content type is not accepted",
    ],
    [HttpStatus.TOO_MANY_REQUESTS, "Too many requests; try again later"],
    [
      HttpStatus.SERVICE_UNAVAILABLE,
      "The platform is busy; try again in a moment",
    ],
  ]);

  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(error: unknown, host: ArgumentsHost): void {
    if (host.getType() !== ProblemDetailsFilter.HTTP) throw error;

    const exception = this.#httpExceptionOf(error);
    const status = exception.getStatus();
    const problem = this.#problemOf(exception);
    const headers = this.#headersOf(exception, error);
    const response = host.switchToHttp().getResponse<unknown>();
    const adapter = this.adapterHost.httpAdapter;

    for (const [name, value] of Object.entries(headers))
      adapter.setHeader(response, name, value);

    adapter.setHeader(
      response,
      "Content-Type",
      ProblemDetailsFilter.MEDIA_TYPE,
    );
    adapter.reply(response, problem, status);
  }

  #httpExceptionOf(error: unknown): HttpException {
    if (error instanceof HttpException) return error;

    if (error instanceof StaleWriteError)
      return new ConflictException(error.message, { cause: error });

    if (this.#isShed(error))
      return new ServiceUnavailableException(error.message, { cause: error });

    this.logger.error(error);
    return new InternalServerErrorException(ProblemDetailsFilter.INTERNAL);
  }

  #problemOf(exception: HttpException): ProblemDetails {
    const answer = exception.getResponse();

    if (this.#isProblem(answer)) return answer;

    const status = exception.getStatus();
    const title = STATUS_CODES[status] ?? exception.name;
    const body: NestErrorBody =
      typeof answer === "string" ? { message: answer } : answer;
    const detail = this.#detailOf(body.message, title, status);
    const code = this.#codeOf(body.code, exception);
    return { type: ProblemDetailsFilter.BLANK, title, status, detail, code };
  }

  #isProblem(answer: string | object): answer is ProblemDetails {
    return (
      typeof answer === "object" &&
      "type" in answer &&
      typeof answer.type === "string"
    );
  }

  #detailOf(message: unknown, title: string, status: number): string {
    const told = typeof message === "string" && message !== title;

    if (told) return message;

    if (Array.isArray(message))
      return message.join(ProblemDetailsFilter.SEPARATOR);

    const sentence = ProblemDetailsFilter.SENTENCES.get(status);
    return sentence ?? ProblemDetailsFilter.UNEXPLAINED;
  }

  #codeOf(code: unknown, exception: HttpException): string | undefined {
    if (typeof code === "string") return code;

    return exception.errorCode;
  }

  #isShed(error: unknown): error is Shed {
    return (
      error instanceof BulkheadFullError ||
      error instanceof CircuitOpenError ||
      error instanceof OutboundRateLimitError
    );
  }

  #headersOf(exception: HttpException, error: unknown): ResponseHeaders {
    if (exception instanceof ConditionalRequestException)
      return exception.headers;

    const shed = this.#isShed(error) ? error : exception.cause;

    if (this.#isShed(shed)) {
      const after = shed.retryAfterMs ?? ProblemDetailsFilter.SOON_MS;
      const exact = after / 1_000;
      const whole = Math.ceil(exact);
      const seconds = String(whole);
      return { [ProblemDetailsFilter.RETRY_AFTER]: seconds };
    }

    return ProblemDetailsFilter.NO_HEADERS;
  }
}
