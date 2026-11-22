import { Injectable, Logger } from "@nestjs/common";
import { OnOneInstance, WithoutOverlapping } from "@nestjs/locks";
import { OutboxInbox } from "@nestjs/outbox";
import { Cron, CronExpression } from "@nestjs/schedule";
import { WorkflowClient } from "@nestjs/workflows";
import { PostgresEmailTokenStore } from "../../interface-adapters/persistence/stores/postgres-email-token.store.js";
import { PostgresIdempotencyStore } from "../../interface-adapters/persistence/stores/postgres-idempotency.store.js";
import { PostgresSessionStore } from "../../interface-adapters/persistence/stores/postgres-session.store.js";

@Injectable()
export class RetentionJobs {
  private static readonly RETENTION = "30d";
  private static readonly IDEMPOTENCY_BATCH = 1_000;

  private readonly logger = new Logger(RetentionJobs.name);

  constructor(
    private readonly workflows: WorkflowClient,
    private readonly inbox: OutboxInbox,
    private readonly idempotency: PostgresIdempotencyStore,
    private readonly sessions: PostgresSessionStore,
    private readonly emailTokens: PostgresEmailTokenStore,
  ) {}

  @Cron("30 3 * * *")
  @OnOneInstance({ key: "workflows:purge" })
  @WithoutOverlapping()
  async purgeWorkflows(): Promise<void> {
    const purged = await this.workflows.purge({
      olderThan: RetentionJobs.RETENTION,
    });
    this.logger.log(purged, "Purged the finished workflow instances");
  }

  @Cron("0 4 * * *")
  @OnOneInstance({ key: "outbox:prune-inbox" })
  @WithoutOverlapping()
  async pruneInbox(): Promise<void> {
    const records = await this.inbox.prune(RetentionJobs.RETENTION);
    this.logger.log({ records }, "Pruned the outbox inbox");
  }

  @Cron(CronExpression.EVERY_HOUR)
  @OnOneInstance({ key: "idempotency:prune" })
  @WithoutOverlapping()
  async pruneIdempotencyKeys(): Promise<void> {
    const records = await this.idempotency.prune(
      RetentionJobs.IDEMPOTENCY_BATCH,
    );
    this.logger.log({ records }, "Pruned the expired idempotency keys");
  }

  @Cron("30 4 * * *")
  @OnOneInstance({ key: "identity:prune-expired" })
  @WithoutOverlapping()
  async pruneExpiredIdentity(): Promise<void> {
    const sessions = await this.sessions.prune();
    const emailTokens = await this.emailTokens.prune();
    this.logger.log(
      { sessions, emailTokens },
      "Pruned the expired sessions and email tokens",
    );
  }
}
