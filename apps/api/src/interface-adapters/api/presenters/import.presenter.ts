import { type HttpException, Injectable } from "@nestjs/common";
import type { Missing } from "../../../application/automation/enums.js";
import type {
  FetchedImport,
  ImportFailure,
} from "../../../application/automation/imports/interfaces.js";
import type { ImportTextResponse } from "../schemas/import.schemas.js";
import { ProblemPresenter } from "./problem.presenter.js";

@Injectable()
export class ImportPresenter {
  constructor(private readonly problemPresenter: ProblemPresenter) {}

  text(fetched: FetchedImport): ImportTextResponse {
    return { text: fetched.text };
  }

  refusalOf(failure: ImportFailure | Missing): HttpException {
    if (typeof failure === "string") return this.problemPresenter.of(failure);

    return this.problemPresenter.detailed(failure.refusal, failure.detail);
  }
}
