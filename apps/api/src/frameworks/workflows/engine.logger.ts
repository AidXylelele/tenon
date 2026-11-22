import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { type WorkflowEvent, WorkflowEvents } from "@nestjs/workflows";

@Injectable()
export class EngineLogger implements OnModuleInit {
  private readonly logger = new Logger(EngineLogger.name);

  constructor(private readonly events: WorkflowEvents) {}

  onModuleInit(): void {
    this.events.events$.subscribe((event) => {
      this.#log(event);
    });
  }

  #log(event: WorkflowEvent): void {
    if (event.type !== "workflow-compensation-failed") return;

    this.logger.error(
      {
        instanceId: event.id,
        workflow: event.workflow,
        version: event.version,
        err: event.error,
      },
      `The compensation of ${event.workflow} instance ${event.id} failed and needs a person`,
    );
  }
}
