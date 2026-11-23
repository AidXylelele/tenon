import { Injectable, Logger } from "@nestjs/common";
import { OnOneInstance } from "@nestjs/locks";
import { Timeout } from "@nestjs/schedule";
import { ArmSchedules } from "../../application/automation/schedules/arm-schedules.js";

@Injectable()
export class ScheduleJobs {
  private readonly logger = new Logger(ScheduleJobs.name);

  constructor(private readonly armSchedules: ArmSchedules) {}

  @Timeout(0)
  @OnOneInstance({ key: "schedules:arm" })
  async armUnarmed(): Promise<void> {
    await this.armSchedules.execute();
    this.logger.log("Armed the unarmed schedules");
  }
}
