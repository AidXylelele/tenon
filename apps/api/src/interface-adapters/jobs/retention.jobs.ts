import { Injectable, Logger } from "@nestjs/common";
import { OnOneInstance, WithoutOverlapping } from "@nestjs/locks";
import { OutboxDeadLetters, OutboxInbox } from "@nestjs/outbox";
import { Cron } from "@nestjs/schedule";

@Injectable()
export class RetentionJobs {
  private readonly logger = new Logger(RetentionJobs.name);

  constructor(
    private readonly deadLetters: OutboxDeadLetters,
    private readonly inbox: OutboxInbox,
  ) {}

  @Cron("30 3 * * *")
  @OnOneInstance({ key: "outbox:purge-dead-letters" })
  @WithoutOverlapping()
  async purgeDeadLetters(): Promise<void> {
    const kept = 14 * 86_400_000;
    const failedBefore = new Date(Date.now() - kept);
    const purged = await this.deadLetters.purge({ failedBefore });
    this.logger.log({ purged }, "Purged the outbox dead letters");
  }

  @Cron("0 4 * * *")
  @OnOneInstance({ key: "outbox:prune-inbox" })
  @WithoutOverlapping()
  async pruneInbox(): Promise<void> {
    const retention = "30d";
    const records = await this.inbox.prune(retention);
    this.logger.log({ records }, "Pruned the outbox inbox");
  }
}
