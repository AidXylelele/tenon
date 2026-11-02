import { Public } from '@nestjs/authentication';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { DatabaseProbe } from '../interfaces.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseProbe,
  ) {}

  // Ready while the database answers: 503 otherwise, so traffic goes to another node.
  @Get()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check([() => this.database.isReachable()]);
  }
}
