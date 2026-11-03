'use server';

import { refresh } from 'next/cache';
import { createWebhook, deleteWebhook } from '@/libs/data-access/automation';
import type { Outcome } from '@/libs/data-access/problem';
import type { CreatedWebhook } from '@/libs/data-access/types';

// The URL comes back once, in this answer, and the console keeps it nowhere (002 FR-024).
export async function createWebhookAction(
  name: string,
  eventType: string,
): Promise<Outcome<CreatedWebhook>> {
  const outcome = await createWebhook(name, eventType);
  refresh();
  return outcome;
}

export async function deleteWebhookAction(id: string): Promise<Outcome<void>> {
  const outcome = await deleteWebhook(id);
  refresh();
  return outcome;
}
