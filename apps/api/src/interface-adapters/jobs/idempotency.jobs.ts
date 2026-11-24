import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { PostgresIdempotencyStore } from "../persistence/stores/postgres-idempotency.store.js";

@Injectable()
export class IdempotencyJobs {
  private readonly logger = new Logger(IdempotencyJobs.name);

  constructor(private readonly idempotency: PostgresIdempotencyStore) {}

  @Interval("idempotency:prune", 60_000)
  async pruneExpiredKeys(): Promise<void> {
    const records = await this.idempotency.prune();
    this.logger.debug({ records }, "Pruned the expired idempotency keys");
  }
}
