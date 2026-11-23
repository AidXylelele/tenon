import { Injectable } from "@nestjs/common";
import { Missing } from "../../../application/automation/enums.js";
import { InstanceQueries } from "../../../application/automation/instances/queries.js";
import { InstancePresenter } from "../presenters/instance.presenter.js";
import { ProblemPresenter } from "../presenters/problem.presenter.js";
import type { InstanceSummaryResponse } from "../schemas/instance.schema.js";

@Injectable()
export class InstanceReadBack {
  constructor(
    private readonly instances: InstanceQueries,
    private readonly instancePresenter: InstancePresenter,
    private readonly problemPresenter: ProblemPresenter,
  ) {}

  async summaryOf(id: string): Promise<InstanceSummaryResponse> {
    const instance = await this.instances.get(id);

    if (instance === null) throw this.problemPresenter.of(Missing.Instance);

    return this.instancePresenter.summary(instance);
  }
}
