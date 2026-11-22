import { Injectable } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import {
  type HealthCheckAttempt,
  HealthIndicatorService,
} from "@nestjs/terminus";
import { sql } from "drizzle-orm";
import type { Database } from "./interfaces.js";

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly health: HealthIndicatorService,
    @InjectDrizzle() private readonly db: Database,
  ) {}

  check(): HealthCheckAttempt<"database"> {
    return this.health
      .check("database")
      .attempt(async () => {
        await this.db.execute(sql`select 1`);
      })
      .withTimeout(1_500)
      .cacheFor(1_000);
  }
}
