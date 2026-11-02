import { Injectable } from '@nestjs/common';
import {
  type HealthCheckAttempt,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import type { HealthClient } from '../../interface-adapters/api/interfaces.js';
import { Database } from '../../interface-adapters/persistence/interfaces.js';

@Injectable()
export class TerminusHealthClient implements HealthClient {
  private static readonly DATABASE = 'database';
  // Shorter than a load balancer's probe, so a hung database reads as down, not as no answer.
  private static readonly TIMEOUT_MS = 1_500;
  // One query a second at most, however often the public route is asked.
  private static readonly CACHED_MS = 1_000;

  constructor(
    private readonly health: HealthIndicatorService,
    private readonly db: Database,
  ) {}

  database(): HealthCheckAttempt<'database'> {
    return this.health
      .check(TerminusHealthClient.DATABASE)
      .attempt(async () => {
        await this.db.execute(sql`select 1`);
      })
      .withTimeout(TerminusHealthClient.TIMEOUT_MS)
      .cacheFor(TerminusHealthClient.CACHED_MS);
  }
}
