import {
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  PreconditionFailedException,
} from "@nestjs/common";
import { firstValueFrom, throwError } from "rxjs";
import { StaleWriteError } from "../../../src/domain/errors.js";
import { StaleDraftInterceptor } from "../../../src/interface-adapters/api/interceptors/stale-draft.interceptor.js";
import { EntityTagMapper } from "../../../src/interface-adapters/api/mappers/entity-tag.mapper.js";
import { DraftPresenter } from "../../../src/interface-adapters/api/presenters/draft.presenter.js";
import { ProblemPresenter } from "../../../src/interface-adapters/api/presenters/problem.presenter.js";

describe("the stale draft interceptor", () => {
  const presenter = new DraftPresenter(
    new ProblemPresenter(),
    new EntityTagMapper(),
  );
  const interceptor = new StaleDraftInterceptor(presenter);
  const context = {} as ExecutionContext;

  function failing(error: Error): CallHandler {
    return { handle: () => throwError(() => error) };
  }

  it("a_lost_race_on_a_draft_write_answers_that_the_draft_is_stale", async () => {
    const lost = new StaleWriteError();
    const next = failing(lost);

    const answered = interceptor.intercept(context, next);
    const refused = firstValueFrom(answered);

    await expect(refused).rejects.toBeInstanceOf(PreconditionFailedException);
    await expect(refused).rejects.toMatchObject({
      response: {
        type: "urn:problem:draft.stale",
        status: HttpStatus.PRECONDITION_FAILED,
      },
    });
  });

  it("any_other_error_passes_through_unchanged", async () => {
    const unexpected = new Error("disk full");
    const next = failing(unexpected);

    const answered = interceptor.intercept(context, next);
    const passed = firstValueFrom(answered);

    await expect(passed).rejects.toBe(unexpected);
  });
});
