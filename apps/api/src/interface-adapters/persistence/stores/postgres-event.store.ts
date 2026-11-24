import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { and, eq } from "drizzle-orm";
import { EventOrigin } from "../../../application/automation/events/enums.js";
import type {
  AcceptedEvent,
  CloudEvent,
} from "../../../application/automation/events/interfaces.js";
import type { EventStore } from "../../../application/automation/events/ports.js";
import type { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import type { WebhookEvent } from "../../../domain/automation/webhooks/interfaces.js";
import type {
  EventRow,
  LifecycleCloudEvent,
  Transaction,
} from "../interfaces.js";
import { WebhookEventMapper } from "../mappers/webhook-event.mapper.js";
import {
  event as events,
  workflowInstance as instances,
} from "../schema/index.js";

@Injectable()
export class PostgresEventStore implements EventStore {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly webhookEventMapper: WebhookEventMapper,
  ) {}

  accept(
    cloudEvent: CloudEvent,
    origin: EventOrigin,
    instanceId: string | null,
    acceptedAt: Date,
  ): Promise<AcceptedEvent[]> {
    const source = cloudEvent.source as string;
    const eventId = cloudEvent.id as string;
    const type = cloudEvent.type as string;
    const row = {
      source,
      eventId,
      type,
      origin,
      instanceId,
      execution: null,
      lifecycle: null,
      cloudEvent,
      acceptedAt,
    };
    return this.#inserted([row], null);
  }

  acceptLifecycle(
    told: readonly LifecycleCloudEvent[],
    instance: WorkflowInstance,
    acceptedAt: Date,
  ): Promise<AcceptedEvent[]> {
    const rows = told.map((each) => {
      const cloudEvent = each.cloudEvent;
      return {
        source: cloudEvent.source as string,
        eventId: cloudEvent.id as string,
        type: cloudEvent.type as string,
        origin: EventOrigin.Lifecycle,
        instanceId: instance.id,
        execution: each.execution,
        lifecycle: each.lifecycle,
        cloudEvent,
        acceptedAt,
      };
    });
    return this.#inserted(rows, instance.workflowId);
  }

  acceptWebhookEvent(event: WebhookEvent): Promise<AcceptedEvent[]> {
    const cloudEvent = this.webhookEventMapper.toCloudEvent(event);
    return this.accept(cloudEvent, EventOrigin.Webhook, null, event.at);
  }

  async #inserted(
    rows: EventRow[],
    lifecycleOf: string | null,
  ): Promise<AcceptedEvent[]> {
    const inserted = await this.txHost.tx
      .insert(events)
      .values(rows)
      .onConflictDoNothing({ target: [events.source, events.eventId] })
      .returning({
        sequence: events.sequence,
        source: events.source,
        eventId: events.eventId,
      });
    return inserted.flatMap((accepted) => {
      const row = rows.find(
        (each) =>
          each.source === accepted.source && each.eventId === accepted.eventId,
      );

      if (row === undefined) return [];

      return [
        {
          sequence: accepted.sequence,
          eventId: row.eventId,
          type: row.type,
          cloudEvent: row.cloudEvent,
          acceptedAt: row.acceptedAt,
          lifecycleOf,
        },
      ];
    });
  }

  async find(sequence: number): Promise<AcceptedEvent | null> {
    const lifecycle = eq(events.origin, EventOrigin.Lifecycle);
    const [row] = await this.txHost.tx
      .select({ event: events, lifecycleOf: instances.workflowId })
      .from(events)
      .leftJoin(instances, and(lifecycle, eq(instances.id, events.instanceId)))
      .where(eq(events.sequence, sequence));

    if (!row) return null;

    return {
      sequence: row.event.sequence,
      eventId: row.event.eventId,
      type: row.event.type,
      cloudEvent: row.event.cloudEvent,
      acceptedAt: row.event.acceptedAt,
      lifecycleOf: row.lifecycleOf,
    };
  }
}
