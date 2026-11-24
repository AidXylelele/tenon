import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { type NewOutboxMessage, Outbox } from "@nestjs/outbox";
import { EventOrigin } from "../../../application/automation/events/enums.js";
import type {
  AcceptedEvent,
  CloudEvent,
  InstanceOffer,
} from "../../../application/automation/events/interfaces.js";
import type {
  EventAnnouncements,
  EventOffers,
} from "../../../application/automation/events/ports.js";
import type { Transaction } from "../../persistence/interfaces.js";
import { MessageTopic } from "../enums.js";
import type {
  AcceptedEventMessage,
  EventOfferedMessage,
  TriggerOfferedMessage,
} from "../interfaces.js";

@Injectable()
export class EventMessagesProducer implements EventAnnouncements, EventOffers {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly outbox: Outbox,
  ) {}

  async announce(
    events: readonly AcceptedEvent[],
    origin: EventOrigin,
  ): Promise<void> {
    const messages = events.map((event) => this.#acceptedOf(event, origin));

    if (messages.length > 0) await this.outbox.add(this.txHost.tx, messages);
  }

  async offer(
    offers: readonly InstanceOffer[],
    event: AcceptedEvent,
  ): Promise<void> {
    const messages = offers.map((offer) => this.#offeredOf(offer, event));

    if (messages.length > 0) await this.outbox.add(this.txHost.tx, messages);
  }

  async trigger(
    workflowIds: readonly string[],
    event: AcceptedEvent,
  ): Promise<void> {
    const messages = workflowIds.map((workflowId) =>
      this.#triggeredOf(workflowId, event),
    );

    if (messages.length > 0) await this.outbox.add(this.txHost.tx, messages);
  }

  #acceptedOf(event: AcceptedEvent, origin: EventOrigin): NewOutboxMessage {
    const payload: AcceptedEventMessage = { sequence: event.sequence };
    const key = this.#laneOf(origin, event.cloudEvent);
    return { topic: MessageTopic.EventAccepted, key, payload };
  }

  #offeredOf(offer: InstanceOffer, event: AcceptedEvent): NewOutboxMessage {
    const payload: EventOfferedMessage = {
      instanceId: offer.instanceId,
      sequence: event.sequence,
      candidates: offer.candidates,
    };
    return { topic: MessageTopic.EventOffered, key: offer.instanceId, payload };
  }

  #triggeredOf(workflowId: string, event: AcceptedEvent): NewOutboxMessage {
    const payload: TriggerOfferedMessage = {
      workflowId,
      sequence: event.sequence,
    };
    return { topic: MessageTopic.TriggerOffered, key: event.eventId, payload };
  }

  #laneOf(origin: EventOrigin, cloudEvent: CloudEvent): string {
    switch (origin) {
      case EventOrigin.Emit:
      case EventOrigin.Lifecycle:
        return cloudEvent.source as string;
      case EventOrigin.Intake:
      case EventOrigin.Webhook:
        return cloudEvent.id as string;
    }
  }
}
