import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { catchError, type Observable, throwError } from "rxjs";
import { StaleWriteError } from "../../../domain/stale-write.error.js";
import { DraftPresenter } from "../presenters/draft.presenter.js";

@Injectable()
export class StaleDraftInterceptor implements NestInterceptor {
  constructor(private readonly draftPresenter: DraftPresenter) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const answered = catchError((error: unknown) =>
      throwError(() => this.#answerOf(error)),
    );
    return next.handle().pipe(answered);
  }

  #answerOf(error: unknown): unknown {
    if (error instanceof StaleWriteError) return this.draftPresenter.lostRace();

    return error;
  }
}
