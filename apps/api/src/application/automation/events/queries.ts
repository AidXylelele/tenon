import type { JsonObject } from '../../../domain/automation/json.js';

export interface EventPage {
  readonly items: readonly JsonObject[];
  readonly next: number | null;
}

export abstract class EventQueries {
  // An instance's lifecycle and emitted events in the order accepted, or null when the instance
  // does not exist.
  abstract ofInstance(
    instanceId: string,
    after: number | null,
    limit: number,
  ): Promise<EventPage | null>;
}
