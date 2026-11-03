import type { JsonObject } from '../../domain/automation/json.js';
import type { TriggerClient } from '../../interface-adapters/workflows/interfaces.js';
import { EventTypes } from './document/event-types.js';
import { JsonPointer } from './document/json-pointer.js';
import type { EventFilters } from './execution/events/event-filters.js';

// `schedule.on`: an event satisfies `one` by its filter and `any` by one of its filters, as a
// `listen` matches them; publish refuses `all` and `until`, which would keep state between events.
export class ScheduleTriggers implements TriggerClient {
  static readonly #AT = JsonPointer.ROOT.child('schedule').child('on');

  constructor(private readonly filters: EventFilters) {}

  async accepts(document: JsonObject, event: JsonObject): Promise<boolean> {
    const schedule = (document.schedule ?? {}) as JsonObject;
    const on = schedule.on as JsonObject | undefined;

    if (on === undefined) return false;

    for (const filter of EventTypes.filtersOf(on)) {
      const correlation = {};
      const matches = await this.filters.matches(
        filter,
        event,
        correlation,
        ScheduleTriggers.#AT,
      );

      if (matches) return true;
    }

    return false;
  }
}
