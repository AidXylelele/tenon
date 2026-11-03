import type { JsonObject } from '../../domain/automation/json.js';
import type {
  CheckProblem,
  FilterClient,
} from '../../interface-adapters/workflows/interfaces.js';
import { JqOutcomeKind } from './enums.js';
import { EventTypes } from './document/event-types.js';
import { Expressions } from './document/expressions.js';
import { JsonPointer } from './document/json-pointer.js';
import { JsonWalk } from './document/json-walk.js';
import type { EventFilters } from './execution/events/event-filters.js';
import type { JqClient } from './interfaces.js';

// A subscription's filter is the standard's event filter: checked as publish checks one, with
// pointers into the filter, and matched as a `listen` matches it.
export class RuntimeFilterClient implements FilterClient {
  static readonly #AT = JsonPointer.ROOT;
  static readonly #NONE = new Set<string>();

  constructor(
    private readonly filters: EventFilters,
    private readonly jq: JqClient,
  ) {}

  async problemOf(filter: JsonObject): Promise<CheckProblem | null> {
    const attributes = (filter.with ?? {}) as JsonObject;
    const values = JsonWalk.valuesOf(attributes, RuntimeFilterClient.#NONE);

    for (const located of values) {
      const text = located.value;

      if (typeof text !== 'string') continue;

      const pointer = `/with${located.pointer.toString()}`;

      if (Expressions.encloses(text)) {
        const program = Expressions.programOf(text);
        const compiled = await this.jq.compile(program);

        if (compiled.kind !== JqOutcomeKind.Compiled)
          return { pointer, detail: 'the expression does not compile' };

        continue;
      }

      try {
        new RegExp(`^(?:${text})$`, 'u');
      } catch {
        return { pointer, detail: 'the pattern is not a regular expression' };
      }
    }

    return null;
  }

  typesOf(filter: JsonObject): string[] | null {
    return EventTypes.of([filter]);
  }

  accepts(filter: JsonObject, event: JsonObject): Promise<boolean> {
    const correlation = {};
    return this.filters.matches(
      filter,
      event,
      correlation,
      RuntimeFilterClient.#AT,
    );
  }
}
