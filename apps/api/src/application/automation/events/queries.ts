import type { EventPage } from "./interfaces.js";

export abstract class EventQueries {
  abstract ofInstance(
    instanceId: string,
    after: number | null,
    limit: number,
  ): Promise<EventPage | null>;
}
