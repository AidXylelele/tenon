'use server';

import { publishEvent } from '@/libs/data-access/automation';
import type { Outcome } from '@/libs/data-access/problem';
import type { CloudEvent } from '@/libs/data-access/types';

export async function sendEventAction(
  event: CloudEvent,
): Promise<Outcome<void>> {
  return publishEvent(event);
}
