import { Public } from "@nestjs/authentication";
import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

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
    return this.health.check([]);
  }
}
