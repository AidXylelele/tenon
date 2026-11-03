'use server';

import { redirect } from 'next/navigation';
import { workflows } from '@/libs/data-access/automation';
import { signOut } from '@/libs/data-access/identity';
import { signInHref } from '@/operations/app-routes';

export async function signOutAction(): Promise<void> {
  await signOut();
  const signIn = signInHref({ reason: 'signed-out' });
  redirect(signIn);
}

export interface FoundWorkflow {
  readonly namespace: string;
  readonly name: string;
  readonly on: boolean;
}

// The active workflows the search offers, read when it opens.
export async function searchableWorkflowsAction(): Promise<FoundWorkflow[]> {
  const page = await workflows('active');
  return page.items.map((each) => ({
    namespace: each.namespace,
    name: each.name,
    on: each.on,
  }));
}
