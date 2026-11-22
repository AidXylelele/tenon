import { Public } from "@nestjs/authentication";
import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { DatabaseHealthIndicator } from "../../persistence/database.health-indicator.js";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
  ) {}

  @Get("live")
  @Public()
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  @Get("ready")
  @Public()
  @HealthCheck()
  ready() {
    return this.health.check([() => this.database.check()]);
  }
}
