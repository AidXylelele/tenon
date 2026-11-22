import { Injectable } from "@nestjs/common";
import { WithoutOverlapping } from "@nestjs/locks";
import { Timeout } from "@nestjs/schedule";
import { RunController } from "../../interface-adapters/workflows/run.controller.js";

@Injectable()
export class StartUpJobs {
  constructor(private readonly runs: RunController) {}

  @Timeout(0)
  @WithoutOverlapping({ key: "runs:cut-over" })
  cutOver(): Promise<void> {
    return this.runs.cutOver();
  }
}
