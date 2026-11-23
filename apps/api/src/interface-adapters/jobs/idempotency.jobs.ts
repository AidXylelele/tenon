import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { PostgresIdempotencyStore } from "../persistence/stores/postgres-idempotency.store.js";

@Injectable()
export class IdempotencyJobs {
  static readonly PRUNE = "idempotency:prune";
  private static readonly PRUNE_MS = 60_000;

  private readonly logger = new Logger(IdempotencyJobs.name);

  constructor(private readonly idempotency: PostgresIdempotencyStore) {}

  @Interval(IdempotencyJobs.PRUNE, IdempotencyJobs.PRUNE_MS)
  async pruneExpiredKeys(): Promise<void> {
    const records = await this.idempotency.prune();
    this.logger.debug({ records }, "Pruned the expired idempotency keys");
  }
}
