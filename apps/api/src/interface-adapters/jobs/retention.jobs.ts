import { Injectable, Logger } from "@nestjs/common";
import { OnOneInstance, WithoutOverlapping } from "@nestjs/locks";
import { OutboxInbox } from "@nestjs/outbox";
import { Cron } from "@nestjs/schedule";
import { WorkflowClient } from "@nestjs/workflows";

@Injectable()
export class RetentionJobs {
  private static readonly RETENTION = "30d";
  private static readonly PURGE = "workflows:purge";
  private static readonly PRUNE = "outbox:prune-inbox";

  private readonly logger = new Logger(RetentionJobs.name);

  constructor(
    private readonly workflows: WorkflowClient,
    private readonly inbox: OutboxInbox,
  ) {}

  @Cron("30 3 * * *")
  @OnOneInstance({ key: RetentionJobs.PURGE })
  @WithoutOverlapping()
  async purgeWorkflows(): Promise<void> {
    const purged = await this.workflows.purge({
      olderThan: RetentionJobs.RETENTION,
    });
    this.logger.log(purged, "Purged the finished workflow instances");
  }

  @Cron("0 4 * * *")
  @OnOneInstance({ key: RetentionJobs.PRUNE })
  @WithoutOverlapping()
  async pruneInbox(): Promise<void> {
    const records = await this.inbox.prune(RetentionJobs.RETENTION);
    this.logger.log({ records }, "Pruned the outbox inbox");
  }
}
