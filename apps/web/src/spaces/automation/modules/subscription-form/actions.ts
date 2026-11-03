'use server';

import { createSubscription } from '@/libs/data-access/automation';
import type { Outcome } from '@/libs/data-access/problem';
import type {
  Endpoint,
  EventFilter,
  Subscription,
} from '@/libs/data-access/types';

export async function createSubscriptionAction(
  name: string,
  endpoint: Endpoint,
  filter: EventFilter,
): Promise<Outcome<Subscription>> {
  return createSubscription(name, endpoint, filter);
}
