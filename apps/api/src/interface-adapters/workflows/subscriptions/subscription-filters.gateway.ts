import { Injectable } from '@nestjs/common';
import type { AcceptedEvent } from '../../../application/automation/events/ports.js';
import type { SubscriptionFilters } from '../../../application/automation/subscriptions/ports.js';
import type { DefinitionProblem } from '../../../application/automation/workflows/ports.js';
import type { JsonObject } from '../../../domain/automation/json.js';
import { FilterClient } from '../interfaces.js';

@Injectable()
export class SubscriptionFiltersGateway implements SubscriptionFilters {
  constructor(private readonly client: FilterClient) {}

  problemOf(filter: JsonObject): Promise<DefinitionProblem | null> {
    return this.client.problemOf(filter);
  }

  typesOf(filter: JsonObject): readonly string[] | null {
    return this.client.typesOf(filter);
  }

  accepts(filter: JsonObject, event: AcceptedEvent): Promise<boolean> {
    return this.client.accepts(filter, event.cloudEvent);
  }
}
