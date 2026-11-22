import { Injectable } from "@nestjs/common";
import {
  Propagation,
  Transactional,
  TransactionHost,
} from "@nestjs-cls/transactional";
import { Outbox } from "@nestjs/outbox";
import { and, eq } from "drizzle-orm";
import { EventOrigin } from "../../../application/automation/events/enums.js";
import type {
  AcceptedEvent,
  CloudEvent,
} from "../../../application/automation/events/interfaces.js";
import type { EventStore } from "../../../application/automation/events/ports.js";
import type { WebhookEvent } from "../../../domain/automation/webhooks/interfaces.js";
import { MessageTopic } from "../../messaging/enums.js";
import type { AcceptedEventMessage } from "../../messaging/interfaces.js";
import { OutboxTracer } from "../../messaging/outbox.tracer.js";
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
  private static readonly KEY = "events";

  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly outbox: Outbox,
    private readonly webhookEventMapper: WebhookEventMapper,
    private readonly tracer: OutboxTracer,
  ) {}

  @Transactional(Propagation.Required)
  accept(
    cloudEvent: CloudEvent,
    origin: EventOrigin,
    instanceId: string | null,
    acceptedAt: Date,
  ): Promise<number | null> {
    const source = cloudEvent.source as string;
    const eventId = cloudEvent.id as string;
    const type = cloudEvent.type as string;
    return this.#inserted({
      source,
      eventId,
      type,
      origin,
      instanceId,
      execution: null,
      lifecycle: null,
      cloudEvent,
      acceptedAt,
    });
  }

  @Transactional(Propagation.Required)
  acceptLifecycle(
    told: LifecycleCloudEvent,
    instanceId: string,
    execution: string | null,
    acceptedAt: Date,
  ): Promise<number | null> {
    const cloudEvent = told.cloudEvent;
    const source = cloudEvent.source as string;
    const eventId = cloudEvent.id as string;
    const type = cloudEvent.type as string;
    return this.#inserted({
      source,
      eventId,
      type,
      origin: EventOrigin.Lifecycle,
      instanceId,
      execution,
      lifecycle: told.lifecycle,
      cloudEvent,
      acceptedAt,
    });
  }

  @Transactional(Propagation.Required)
  acceptWebhookEvent(event: WebhookEvent): Promise<number | null> {
    const cloudEvent = this.webhookEventMapper.toCloudEvent(event);
    return this.accept(cloudEvent, EventOrigin.Webhook, null, event.at);
  }

  async #inserted(row: EventRow): Promise<number | null> {
    const [accepted] = await this.txHost.tx
      .insert(events)
      .values(row)
      .onConflictDoNothing({ target: [events.source, events.eventId] })
      .returning({ sequence: events.sequence });

    if (accepted === undefined) return null;

    const sequence = accepted.sequence;
    const payload: AcceptedEventMessage = { sequence };
    await this.outbox.add(this.txHost.tx, [
      {
        topic: MessageTopic.EventAccepted,
        key: PostgresEventStore.KEY,
        payload,
        headers: this.tracer.headers(),
      },
    ]);
    return sequence;
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
