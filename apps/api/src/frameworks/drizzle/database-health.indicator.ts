import { Injectable } from '@nestjs/common';
import {
  type HealthCheckAttempt,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import type { DatabaseProbe } from '../../interface-adapters/api/interfaces.js';
import { Database } from '../../interface-adapters/persistence/interfaces.js';

@Injectable()
export class DatabaseHealthIndicator implements DatabaseProbe {
  private static readonly KEY = 'database';
  // Shorter than a load balancer's probe, so a hung database reads as down, not as no answer.
  private static readonly TIMEOUT_MS = 1_500;

  constructor(
    private readonly health: HealthIndicatorService,
    private readonly database: Database,
  ) {}

  isReachable(): HealthCheckAttempt<'database'> {
    return this.health
      .check(DatabaseHealthIndicator.KEY)
      .attempt(async () => {
        await this.database.execute(sql`select 1`);
      })
      .withTimeout(DatabaseHealthIndicator.TIMEOUT_MS);
  }
}
