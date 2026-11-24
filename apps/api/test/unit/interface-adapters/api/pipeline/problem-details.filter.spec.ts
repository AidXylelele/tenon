import {
  type ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import type { HttpAdapterHost } from "@nestjs/core";
import { StaleWriteError } from "../../../../../src/domain/stale-write.error.js";
import { ConditionalRequestException } from "../../../../../src/interface-adapters/api/pipeline/conditional-request.exception.js";
import { ProblemDetailsFilter } from "../../../../../src/interface-adapters/api/pipeline/problem-details.filter.js";

const PROBLEM = "application/problem+json";

describe("the problem details filter", () => {
  const response = {};
  const setHeader = vi.fn();
  const reply = vi.fn();
  const adapterHost = {
    httpAdapter: { setHeader, reply },
  } as unknown as HttpAdapterHost;
  const host = {
    getType: () => "http",
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  const filter = new ProblemDetailsFilter(adapterHost);

  beforeEach(() => {
    setHeader.mockClear();
    reply.mockClear();
  });

  it("a_refusal_is_written_as_its_own_problem_in_the_problem_media_type", () => {
    const problem = {
      type: "urn:problem:workflow.archived",
      title: "The workflow is archived",
      status: HttpStatus.CONFLICT,
      detail: "The workflow is archived",
    };
    const refused = new ConflictException(problem);

    filter.catch(refused, host);

    expect(setHeader).toHaveBeenCalledWith(response, "Content-Type", PROBLEM);
    expect(reply).toHaveBeenCalledWith(response, problem, HttpStatus.CONFLICT);
  });

  it("a_nest_exception_is_an_about_blank_problem_with_its_messages_as_the_detail", () => {
    const refused = new BadRequestException([
      "email: Invalid",
      "role: Invalid",
    ]);

    filter.catch(refused, host);

    expect(reply).toHaveBeenCalledWith(
      response,
      {
        type: "about:blank",
        title: "Bad Request",
        status: HttpStatus.BAD_REQUEST,
        detail: "email: Invalid; role: Invalid",
        code: undefined,
      },
      HttpStatus.BAD_REQUEST,
    );
  });

  it("a_text_answer_is_the_detail_under_the_status_phrase", () => {
    const refused = new HttpException("Already taken", HttpStatus.CONFLICT);

    filter.catch(refused, host);

    expect(reply).toHaveBeenCalledWith(
      response,
      expect.objectContaining({
        title: "Conflict",
        status: HttpStatus.CONFLICT,
        detail: "Already taken",
      }),
      HttpStatus.CONFLICT,
    );
  });

  it("an_error_code_stays_as_the_problem_code_and_the_detail_is_a_sentence_not_the_title", () => {
    const refused = new UnauthorizedException(undefined, {
      errorCode: "missing_credentials",
    });

    filter.catch(refused, host);

    expect(reply).toHaveBeenCalledWith(
      response,
      expect.objectContaining({
        title: "Unauthorized",
        detail: "Sign in to continue",
        code: "missing_credentials",
      }),
      HttpStatus.UNAUTHORIZED,
    );
  });

  it("a_lost_optimistic_race_answers_a_conflict", () => {
    const lost = new StaleWriteError();

    filter.catch(lost, host);

    expect(reply).toHaveBeenCalledWith(
      response,
      expect.objectContaining({
        type: "about:blank",
        title: "Conflict",
        status: HttpStatus.CONFLICT,
        detail: lost.message,
      }),
      HttpStatus.CONFLICT,
    );
  });

  it("the_headers_a_conditional_request_exception_carries_are_written", () => {
    const problem = {
      type: "urn:problem:draft.stale",
      title: "The draft is not at the revision you sent",
      status: HttpStatus.PRECONDITION_FAILED,
      detail: "The draft is not at the revision you sent",
    };
    const headers = { ETag: '"r2"' };
    const refused = new ConditionalRequestException(problem, headers);

    filter.catch(refused, host);

    expect(setHeader).toHaveBeenCalledWith(response, "ETag", '"r2"');
    expect(reply).toHaveBeenCalledWith(
      response,
      problem,
      HttpStatus.PRECONDITION_FAILED,
    );
  });
});
