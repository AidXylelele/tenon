import type { Event } from '../../../domain/automation/events/event.js';

export abstract class EventRepository {
  abstract addAll(events: readonly Event[]): Promise<void>;
}
