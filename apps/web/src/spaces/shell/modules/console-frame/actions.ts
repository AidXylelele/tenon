'use server';

import { redirect } from 'next/navigation';
import { signOut } from '@/libs/data-access/identity';

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect('/sign-in?reason=signed-out');
}
