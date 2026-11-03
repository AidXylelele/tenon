'use server';

import { redirect } from 'next/navigation';
import { deleteSubscription } from '@/libs/data-access/automation';
import type { Outcome } from '@/libs/data-access/problem';

export async function deleteSubscriptionAction(
  id: string,
): Promise<Outcome<void>> {
  const outcome = await deleteSubscription(id);

  if (!outcome.ok) return outcome;

  redirect('/connections/notifications');
}
