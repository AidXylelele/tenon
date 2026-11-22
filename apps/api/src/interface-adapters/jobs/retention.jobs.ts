import { Injectable, Logger } from "@nestjs/common";
import { OnOneInstance, WithoutOverlapping } from "@nestjs/locks";
import { OutboxInbox } from "@nestjs/outbox";
import { Cron } from "@nestjs/schedule";
import { WorkflowClient } from "@nestjs/workflows";
import { JobTracer } from "./job.tracer.js";

@Injectable()
export class RetentionJobs {
  private static readonly RETENTION = "30d";
  private static readonly PURGE = "workflows:purge";
  private static readonly PRUNE = "outbox:prune-inbox";

  private readonly logger = new Logger(RetentionJobs.name);

  constructor(
    private readonly workflows: WorkflowClient,
    private readonly inbox: OutboxInbox,
    private readonly tracer: JobTracer,
  ) {}

  @Cron("30 3 * * *")
  @OnOneInstance({ key: RetentionJobs.PURGE })
  @WithoutOverlapping()
  purgeWorkflows(): Promise<void> {
    return this.tracer.run(RetentionJobs.PURGE, () => this.#purged());
  }

  @Cron("0 4 * * *")
  @OnOneInstance({ key: RetentionJobs.PRUNE })
  @WithoutOverlapping()
  pruneInbox(): Promise<void> {
    return this.tracer.run(RetentionJobs.PRUNE, () => this.#pruned());
  }

  async #purged(): Promise<void> {
    const purged = await this.workflows.purge({
      olderThan: RetentionJobs.RETENTION,
    });
    this.logger.log(purged, "Purged the finished workflow instances");
  }

  async #pruned(): Promise<void> {
    const records = await this.inbox.prune(RetentionJobs.RETENTION);
    this.logger.log({ records }, "Pruned the outbox inbox");
  }
}
